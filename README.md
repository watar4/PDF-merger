# PDF Merger

複数の PDF を **ブラウザだけで** ひとつに結合するシンプルなツールです。
ファイルはサーバーに送信されず、すべて端末内 (JavaScript) で処理されます。

## 特長

- インストール不要(ブラウザを開くだけ)
- PDF はアップロードされない(プライバシー安全)
- ドラッグ & ドロップで並び替え
- 出力ファイル名を指定可能
- 静的ファイルのみ → **GitHub Pages で無料公開可能**

## ローカルで試す

特別なビルドは不要です。`index.html` をブラウザで直接開いても動きますが、
ローカルサーバーで開くのが確実です:

```bash
# Python があれば
python -m http.server 8000
# → http://localhost:8000 を開く
```

## GitHub で一般公開する手順

GitHub Pages を使えば、無料で世界中からアクセスできる URL に置けます。

### 1. GitHub アカウントを用意

まだなら https://github.com/signup で作成。

### 2. リポジトリを作る

GitHub 右上の「+」→「New repository」で、
- **Repository name**: `pdf-merger`(任意)
- **Public** を選択(Pages を無料で使うため)
- 「Create repository」

### 3. このフォルダを push する

このフォルダ (`pdf-merger/`) で以下を実行:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/pdf-merger.git
git push -u origin main
```

### 4. GitHub Pages を有効化

1. リポジトリの **Settings** → サイドバーの **Pages**
2. **Source** で「Deploy from a branch」
3. **Branch** を `main` / `/ (root)` にして **Save**
4. 1〜2 分待つと上部に公開 URL が表示されます
   例: `https://<ユーザー名>.github.io/pdf-merger/`

その URL を共有すれば誰でも使えます。

## ライセンス

MIT License — `LICENSE` 参照
