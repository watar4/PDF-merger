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

  let files = [];
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

  function render() {
    listSection.hidden = files.length === 0;
    fileListEl.innerHTML = '';
    files.forEach((file, index) => {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.index = String(index);
      li.innerHTML = `
        <span class="handle" aria-hidden="true">⋮⋮</span>
        <span class="file-name"></span>
        <span class="file-meta"></span>
        <button class="remove-btn" type="button" aria-label="削除">×</button>
      `;
      li.querySelector('.file-name').textContent = file.name;
      li.querySelector('.file-meta').textContent = formatSize(file.size);
      li.querySelector('.remove-btn').addEventListener('click', () => {
        files.splice(index, 1);
        render();
      });
      li.addEventListener('dragstart', (e) => {
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
        const moved = files.splice(dragSrcIndex, 1)[0];
        files.splice(index, 0, moved);
        dragSrcIndex = null;
        render();
      });
      fileListEl.appendChild(li);
    });
  }

  function addFiles(fileList) {
    const added = [];
    for (const f of fileList) {
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        added.push(f);
      }
    }
    if (added.length === 0) {
      setStatus('PDF ファイルが見つかりませんでした。', 'error');
      return;
    }
    files = files.concat(added);
    setStatus(`${added.length} 件追加しました(合計 ${files.length} 件)`);
    render();
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
    files = [];
    setStatus('');
    render();
  });

  mergeBtn.addEventListener('click', async () => {
    if (files.length === 0) return;
    mergeBtn.disabled = true;
    setStatus('結合中...');
    try {
      const merged = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        setStatus(`読み込み中 (${i + 1}/${files.length}): ${files[i].name}`);
        const bytes = await files[i].arrayBuffer();
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
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
      setStatus(`完了: ${name} をダウンロードしました(${files.length} 件 / ${formatSize(out.byteLength)})`, 'success');
    } catch (err) {
      console.error(err);
      setStatus('エラー: ' + (err && err.message ? err.message : err), 'error');
    } finally {
      mergeBtn.disabled = false;
    }
  });

  // Try to fill the GitHub repo link automatically when hosted on github.io
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
