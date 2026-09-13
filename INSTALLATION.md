# インストールガイド

Simple Exercise Calendar の詳細なインストール手順です。

## 📋 システム要件

### 必須要件

- **Node.js**: 16.0.0 以上
- **npm**: 7.0.0 以上（Node.js に同梱）
- **OS**: Windows 10/11, macOS 10.15+, Ubuntu 18.04+ またはその他のLinuxディストリビューション

### 推奨要件

- **RAM**: 512MB 以上
- **ストレージ**: 100MB 以上の空き容量
- **ブラウザ**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## 🚀 インストール手順

### 1. Node.js のインストール

#### Windows

1. [Node.js 公式サイト](https://nodejs.org/) から LTS版をダウンロード
2. インストーラーを実行し、指示に従ってインストール
3. コマンドプロンプトまたはPowerShellで確認：

```cmd
node --version
npm --version
```

#### macOS

```bash
# Homebrew を使用する場合
brew install node

# または公式サイトからインストーラーをダウンロード
```

#### Ubuntu/Debian

```bash
# NodeSource リポジトリを使用
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# 確認
node --version
npm --version
```

### 2. プロジェクトのセットアップ

#### Git を使用する場合

```bash
# リポジトリをクローン
git clone https://github.com/kuninet/simple-exercise-calendar.git
cd simple-exercise-calendar
```

#### ZIP ダウンロードの場合

1. GitHub リポジトリページで「Code」→「Download ZIP」
2. ダウンロードしたファイルを解凍
3. 解凍したフォルダに移動

### 3. 依存関係のインストール

```bash
# npm を使用
npm install

# または yarn を使用（yarn がインストールされている場合）
yarn install
```

### 4. データベースの初期化

```bash
npm run init-db
```

このコマンドにより以下が実行されます：

- SQLite データベースファイル（`exercise-app.db`）の作成
- 必要なテーブルの作成
- 初期データ（エクササイズ種類、サンプルユーザー）の挿入

### 5. アプリケーションの起動

```bash
npm start
```

成功すると以下のメッセージが表示されます：

```
サーバーがポート3000で起動しました
http://localhost:3000 でアクセスできます
✅ SQLiteデータベースに接続しました
✅ データベース整合性チェック完了
```

### 6. ブラウザでアクセス

ブラウザで http://localhost:3000 を開いてください。

### 7. モバイル・タブレットでアプリ化（オプション）

**iPhone・iPadの場合：**

1. Safariでアプリにアクセス
2. 共有ボタン（□に↑）をタップ
3. 「ホーム画面に追加」を選択
4. 「追加」をタップ

**Androidの場合：**

1. Chromeでアプリにアクセス
2. メニュー（⋮）をタップ
3. 「ホーム画面に追加」を選択
4. 「追加」をタップ

**アプリ化後の利点：**

- ホーム画面から直接起動
- フルスクリーン表示
- オフライン対応
- 高速起動

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. Node.js のバージョンが古い

```bash
# 現在のバージョンを確認
node --version

# 16.0.0 未満の場合は最新版をインストール
```

#### 2. ポート 3000 が使用中

```bash
# 他のプロセスがポート3000を使用している場合
# Windows
netstat -ano | findstr :3000

# macOS/Linux
lsof -i :3000

# プロセスを終了するか、別のポートを使用
PORT=3001 npm start
```

#### 3. npm install でエラーが発生

```bash
# npm キャッシュをクリア
npm cache clean --force

# node_modules を削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

#### 4. データベース初期化エラー

```bash
# 既存のデータベースファイルを削除
rm exercise-app.db

# 再度初期化
npm run init-db
```

#### 5. 権限エラー（Linux/macOS）

```bash
# npm のグローバルディレクトリを変更
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# .bashrc または .zshrc に追加
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

## 🐳 Docker を使用したインストール

### Dockerfile の作成

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run init-db

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose の使用

```yaml
version: '3.8'
services:
  exercise-calendar:
    build: .
    ports:
      - '3000:3000'
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
```

### Docker でのビルドと実行

```bash
# イメージをビルド
docker build -t simple-exercise-calendar .

# コンテナを実行
docker run -p 3000:3000 simple-exercise-calendar

# または Docker Compose を使用
docker-compose up
```

## 🌐 本番環境へのデプロイ

### 環境変数の設定

本番環境では以下の環境変数を設定することを推奨します：

```bash
export NODE_ENV=production
export PORT=3000
export DB_PATH=/path/to/production/database.db
```

### 🔄 プロセス管理（PM2）- 推奨

**PM2とは？**
Node.jsアプリを安全に運用するためのプロセス管理ツールです。

**PM2の利点：**

- アプリがクラッシュしても自動再起動
- サーバー再起動後も自動でアプリが起動
- ログの自動管理
- バックグラウンドで永続実行

**PM2のインストールと設定：**

```bash
# PM2をインストール
npm install -g pm2

# アプリケーションを起動
pm2 start server.js --name "exercise-calendar"

# サーバー再起動時の自動起動設定
pm2 startup
pm2 save

# 状態確認
pm2 status

# ログ確認
pm2 logs exercise-calendar
```

### 🌐 Webサーバー（Nginx）- オプション

**Nginxが必要な場合：**

- インターネットに公開する場合
- HTTPS（SSL）を使いたい場合
- 複数のアプリを運用する場合
- 高いセキュリティが必要な場合

**家庭内・個人利用の場合：**
PM2のみで十分です。Nginxは不要です。

**Nginx設定例（上級者向け）：**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 📋 デプロイ方法の選択

**🏠 家庭内・個人利用（推奨）:**

```bash
# シンプルな方法
pm2 start server.js --name "exercise-calendar"
pm2 startup
pm2 save
```

- 設定が簡単
- 家庭内ネットワークで十分
- メンテナンスが楽

**🌍 インターネット公開（上級者向け）:**

```bash
# 本格的な方法
pm2 start server.js --name "exercise-calendar"
sudo apt install nginx
# SSL証明書の設定
# ドメインの設定
```

- 高いセキュリティ
- HTTPS対応
- 外部からアクセス可能

## 📱 モバイルアクセス

### ローカルネットワークでのアクセス

1. サーバーを起動：

```bash
npm start
```

2. IPアドレスを確認：

```bash
# Windows
ipconfig

# macOS/Linux
ifconfig
```

3. モバイルデバイスで `http://[IPアドレス]:3000` にアクセス

### PWA（Progressive Web App）として使用

ブラウザで「ホーム画面に追加」を選択すると、アプリのようにアクセスできます。

## 🔄 アップデート手順

### Git を使用している場合

```bash
# 最新版を取得
git pull origin main

# 依存関係を更新
npm install

# データベースを更新（必要に応じて）
npm run init-db

# アプリケーションを再起動
npm start
```

### 手動更新の場合

1. 新しいバージョンをダウンロード
2. 既存の `exercise-app.db` ファイルをバックアップ
3. 新しいファイルで置き換え
4. バックアップしたデータベースファイルを復元
5. `npm install` を実行
6. アプリケーションを再起動

## 📞 サポート

インストールで問題が発生した場合：

1. [GitHub Issues](https://github.com/kuninet/simple-exercise-calendar/issues) で既存の問題を確認
2. 新しい Issue を作成（エラーメッセージとシステム情報を含める）
3. [Discussions](https://github.com/kuninet/simple-exercise-calendar/discussions) で質問

### Issue 作成時に含める情報

- OS とバージョン
- Node.js とnpm のバージョン
- エラーメッセージの全文
- 実行したコマンド
- 期待される動作と実際の動作
