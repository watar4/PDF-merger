(() => {
  const { PDFDocument } = PDFLib;

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const listSection = document.getElementById('list-section');
  const fileListEl = document.getElementById('file-list');
  const mergeBtn = document.getElementById('merge-btn');
  const clearBtn = document.getElementById('clear-btn');
  const outputNameInput = document.getElementById('output-name');
  const statusEl = document.getElementById('status');
  const alignWidthCheck = document.getElementById('align-width');
  const alignBasisSelect = document.getElementById('align-basis');

  // A4 縦の幅(210mm)をポイント換算
  const A4_WIDTH_PT = 595.28;

  alignWidthCheck.addEventListener('change', () => {
    alignBasisSelect.disabled = !alignWidthCheck.checked;
  });

  // 回転を考慮した「見た目」の横幅・縦幅を返す
  function visibleSize(page) {
    const { width, height } = page.getSize();
    const angle = ((page.getRotation().angle % 360) + 360) % 360;
    return (angle === 90 || angle === 270)
      ? { w: height, h: width }
      : { w: width, h: height };
  }

  /** @type {{file: File, bytes: ArrayBuffer, pageCount: number, pageSpec: string}[]} */
  let items = [];
  let dragSrcIndex = null;

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  // --- Page spec parsing ---------------------------------------------------
  // Returns 0-based page indices to copy from a source PDF.
  // Syntax (1-based page numbers):
  //   ""           → all pages
  //   "1-3,5"      → include just these pages, in this order
  //   "-4"         → exclude page 4 (other pages kept in original order)
  //   "-4,-6"      → exclude pages 4 and 6
  //   "-2-5"       → exclude pages 2 through 5
  // Mixing include & exclude in one spec is rejected.
  function resolvePageSpec(spec, total) {
    const allIndices = Array.from({ length: total }, (_, i) => i);
    const trimmed = (spec || '').trim();
    if (!trimmed || trimmed.toLowerCase() === 'all') return allIndices;

    const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    const flags = parts.map(p => p.startsWith('-'));
    const allExclude = flags.every(Boolean);
    const anyExclude = flags.some(Boolean);

    if (anyExclude && !allExclude) {
      throw new Error('「-」を付けるなら全部に付けてください(例: -2,-5 はOK / 1-3,-5 は不可)');
    }

    if (allExclude) {
      const exSet = new Set();
      for (const part of parts) {
        parseRange(part.slice(1), total).forEach(i => exSet.add(i));
      }
      const kept = allIndices.filter(i => !exSet.has(i));
      if (kept.length === 0) throw new Error('全ページが除外指定になっています');
      return kept;
    }

    const result = [];
    for (const part of parts) {
      parseRange(part, total).forEach(i => result.push(i));
    }
    return result;
  }

  function parseRange(s, total) {
    if (s.includes('-')) {
      const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!m) throw new Error(`ページ指定が読めません: "${s}"`);
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (lo < 1 || hi > total) throw new Error(`範囲外: ${s}(1〜${total})`);
      const out = [];
      for (let i = lo; i <= hi; i++) out.push(i - 1);
      return out;
    }
    const n = parseInt(s, 10);
    if (!Number.isFinite(n)) throw new Error(`ページ指定が読めません: "${s}"`);
    if (n < 1 || n > total) throw new Error(`範囲外: ${n}(1〜${total})`);
    return [n - 1];
  }

  // --- Rendering -----------------------------------------------------------
  function render() {
    listSection.hidden = items.length === 0;
    fileListEl.innerHTML = '';
    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.index = String(index);
      li.innerHTML = `
        <span class="handle" aria-hidden="true" title="ドラッグで並べ替え">⋮⋮</span>
        <div class="file-info">
          <div class="file-name"></div>
          <div class="file-meta"></div>
        </div>
        <input class="page-spec" type="text" spellcheck="false"
               placeholder="全ページ(例: 1-3,5 / -4)" />
        <button class="remove-btn" type="button" aria-label="削除">×</button>
      `;
      li.querySelector('.file-name').textContent = item.file.name;
      li.querySelector('.file-meta').textContent =
        `${formatSize(item.file.size)} · ${item.pageCount} ページ`;

      const specInput = li.querySelector('.page-spec');
      specInput.value = item.pageSpec;
      specInput.addEventListener('input', () => {
        item.pageSpec = specInput.value;
        specInput.classList.remove('invalid');
        specInput.title = '';
        if (specInput.value.trim()) {
          try {
            resolvePageSpec(specInput.value, item.pageCount);
          } catch (e) {
            specInput.classList.add('invalid');
            specInput.title = e.message;
          }
        }
      });
      // Stop row-drag from hijacking text selection inside the input
      specInput.addEventListener('mousedown', (e) => e.stopPropagation());
      specInput.addEventListener('dragstart', (e) => e.preventDefault());

      li.querySelector('.remove-btn').addEventListener('click', () => {
        items.splice(index, 1);
        render();
      });

      li.addEventListener('dragstart', (e) => {
        // Don't start row-drag if user clicked inside the input
        if (e.target.classList.contains('page-spec')) {
          e.preventDefault();
          return;
        }
        dragSrcIndex = index;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
      });
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        document.querySelectorAll('.file-list li').forEach(el => el.classList.remove('drag-over'));
      });
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        li.classList.add('drag-over');
      });
      li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        li.classList.remove('drag-over');
        if (dragSrcIndex === null || dragSrcIndex === index) return;
        const moved = items.splice(dragSrcIndex, 1)[0];
        items.splice(index, 0, moved);
        dragSrcIndex = null;
        render();
      });

      fileListEl.appendChild(li);
    });
  }

  // --- File adding ---------------------------------------------------------
  async function addFiles(fileList) {
    const pdfs = [];
    for (const f of fileList) {
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        pdfs.push(f);
      }
    }
    if (pdfs.length === 0) {
      setStatus('PDF ファイルが見つかりませんでした。', 'error');
      return;
    }

    let added = 0;
    for (let i = 0; i < pdfs.length; i++) {
      const f = pdfs[i];
      setStatus(`読み込み中 (${i + 1}/${pdfs.length}): ${f.name}`);
      try {
        const bytes = await f.arrayBuffer();
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        items.push({
          file: f,
          bytes,
          pageCount: doc.getPageCount(),
          pageSpec: '',
        });
        added++;
        render();
      } catch (err) {
        console.error('failed to load', f.name, err);
        setStatus(`読み込み失敗: ${f.name}(${err.message || err})`, 'error');
      }
    }
    if (added > 0) {
      setStatus(`${added} 件追加しました(合計 ${items.length} 件)`);
    }
  }

  fileInput.addEventListener('change', (e) => {
    addFiles(e.target.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    addFiles(e.dataTransfer.files);
  });

  clearBtn.addEventListener('click', () => {
    items = [];
    setStatus('');
    render();
  });

  // --- Merge ---------------------------------------------------------------
  mergeBtn.addEventListener('click', async () => {
    if (items.length === 0) return;
    mergeBtn.disabled = true;

    // Pre-validate every page spec before touching pdf-lib
    const resolved = [];
    try {
      for (const it of items) {
        resolved.push(resolvePageSpec(it.pageSpec, it.pageCount));
      }
    } catch (err) {
      setStatus('ページ指定エラー: ' + err.message, 'error');
      mergeBtn.disabled = false;
      return;
    }

    setStatus('結合中...');
    try {
      const merged = await PDFDocument.create();
      let totalOutPages = 0;
      const addedPages = [];
      for (let i = 0; i < items.length; i++) {
        setStatus(`処理中 (${i + 1}/${items.length}): ${items[i].file.name}`);
        const src = await PDFDocument.load(items[i].bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, resolved[i]);
        pages.forEach(p => {
          merged.addPage(p);
          addedPages.push(p);
        });
        totalOutPages += pages.length;
      }

      // 横幅を揃える(縦横比は維持したまま拡大縮小)
      if (alignWidthCheck.checked && addedPages.length > 0) {
        setStatus('横幅を揃えています...');
        const widths = addedPages.map(p => visibleSize(p).w);
        let targetW;
        if (alignBasisSelect.value === 'min') targetW = Math.min(...widths);
        else if (alignBasisSelect.value === 'a4') targetW = A4_WIDTH_PT;
        else targetW = Math.max(...widths);

        addedPages.forEach(p => {
          const { w } = visibleSize(p);
          const scale = targetW / w;
          if (Math.abs(scale - 1) > 1e-4) p.scale(scale, scale);
        });
      }

      setStatus('書き出し中...');
      const out = await merged.save();
      const blob = new Blob([out], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      let name = (outputNameInput.value || 'merged.pdf').trim();
      if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(
        `完了: ${name} をダウンロード(${items.length} ファイル / ${totalOutPages} ページ / ${formatSize(out.byteLength)})`,
        'success'
      );
    } catch (err) {
      console.error(err);
      setStatus('エラー: ' + (err && err.message ? err.message : err), 'error');
    } finally {
      mergeBtn.disabled = false;
    }
  });

  // --- Footer repo link ----------------------------------------------------
  const repoLink = document.getElementById('repo-link');
  const host = location.hostname;
  if (host.endsWith('.github.io')) {
    const user = host.split('.')[0];
    const repo = location.pathname.split('/').filter(Boolean)[0] || '';
    repoLink.href = repo ? `https://github.com/${user}/${repo}` : `https://github.com/${user}`;
  } else {
    repoLink.style.display = 'none';
  }
})();
