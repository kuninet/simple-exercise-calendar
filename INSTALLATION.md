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

#### 🪟 Windows 環境での PC 起動・サインイン時自動起動設定

Windows では標準の `pm2 startup` が直接動作しないため、以下のいずれかの方法でサインイン時の自動起動を設定します。

##### 方法 A: スタートアップフォルダを利用（推奨・最もシンプル）

管理者権限が不要で、初心者の方でも最も確実・安全に設定できる方法です。

1. **PM2 でアプリを起動し、状態を保存します：**
   ```cmd
   pm2 start server.js --name "exercise-calendar"
   pm2 save
   ```
2. **スタートアップフォルダを開きます：**
   - キーボードの `Windowsキー + R` を同時に押し、「ファイル名を指定して実行」を開きます。
   - `shell:startup` と入力して「OK」をクリックします（スタートアップフォルダが開きます）。
3. **自動起動バッチファイルを作成します：**
   - スタートアップフォルダ内で右クリックし、「新規作成」→「テキスト ドキュメント」を選択します。
   - ファイル名を `pm2-resurrect.bat`（拡張子を `.bat`）に変更します。
   - 右クリックして「編集」を開き、以下の内容を貼り付けて保存します：
     ```cmd
     @echo off
     pm2 resurrect
     ```
4. **動作確認：**
   - PCを再起動または一度サインアウトして再サインインした際、バックグラウンドで `exercise-calendar` が自動起動し、http://localhost:3000 にアクセスできることを確認します。

##### 方法 B: pm2-windows-startup を利用（レジストリ自動起動）

Windows のレジストリ（`Run` キー）に PM2 の自動起動を登録するツールを利用する方法です。

1. **管理者権限でコマンドプロンプトまたは PowerShell を起動します。**
2. **`pm2-windows-startup` をインストールして自動起動を登録します：**
   ```cmd
   npm install -g pm2-windows-startup
   pm2-startup install
   ```
3. **アプリを起動し、状態を保存します：**
   ```cmd
   pm2 start server.js --name "exercise-calendar"
   pm2 save
   ```

> [!NOTE]
> `pm2-windows-startup` は Windows サービスではなく、ユーザーのサインイン時にバックグラウンドで `pm2 resurrect` を実行する仕組みです。設定の簡便さと確実性から、通常は外部モジュール不要の **方法 A（スタートアップフォルダ）を推奨** します。

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

### 🚀 ワンクリック自動アップデート（Windows 推奨）

Windows 環境では、付属の更新スクリプト（`scripts/update-and-restart.bat`）を使用することで、サーバー停止・バックアップ・最新版取得・依存クリーンインストール・サーバー再起動・動作確認までをワンクリックで安全に行えます。

#### 1. 初回準備（デスクトップにショートカットを作成）

1. エクスプローラーで本プロジェクトの `scripts` フォルダを開きます。
2. `update-and-restart.bat` を右クリックし、「その他のオプションを表示」（Windows 11の場合）→「送る」→「デスクトップ (ショートカットを作成)」を選択します。
3. デスクトップに作成されたショートカットの名前を「エクササイズカレンダー更新」などに変更しておくと便利です。

#### 2. アップデートの実行方法

- デスクトップのショートカット（または `scripts/update-and-restart.bat`）を**通常のダブルクリック**で実行します。

> [!IMPORTANT]
> **「管理者として実行」は行わないでください。**
> PM2 は実行ユーザーのホーム領域（`~/.pm2`）でプロセスを管理しているため、管理者権限で実行すると一般ユーザーで起動したプロセスを検知できなくなります。必ず通常のダブルクリック（一般ユーザー権限）で実行してください。

- 実行すると黒い画面（コマンドプロンプト）が開き、自動で以下の処理が安全な順序で進行します：
  1. **前提環境チェック**: `git`, `npm`, `pm2` の存在および `exercise-calendar` の登録状態を確認（未登録時は中断）
  2. **未コミット変更チェック**: 作業中の変更があれば、データ損失を防ぐため**処理を安全に中断**（手動確認を案内）
  3. **サーバー一時停止**: ファイルロックや SQLite 整合性破損を防ぐため、`pm2 stop exercise-calendar` で安全に停止
  4. **データベース自動バックアップ**: プロセス停止直後の `exercise-app.db` を `backups/exercise-app-backup-<日時>.db` に安全にコピー（失敗時はプロセスを復帰して中断）
  5. **最新コードの安全な取得**: `git pull --ff-only` を実行（Fast-forward できない競合がある場合は変更せず安全に中断）
  6. **依存関係のクリーン更新**: `package.json` や `package-lock.json` が更新された場合のみ `npm ci` を実行（失敗時はプロセス復帰して中断）
  7. **プロセスの再起動**: `pm2 restart exercise-calendar` で起動し、`pm2 save` で状態を保存
  8. **ヘルスチェック**: `http://localhost:3000/api/ping` をポーリングしてサーバーの正常稼働を確認
- 「`✅ サーバー再起動および動作確認に成功しました`」と表示されれば更新完了です。何かキーを押して画面を閉じてください。

---

### 💾 データベースのバックアップ保存先と復元手順

自動更新スクリプトを実行するたびに、既存のデータベースが日時付きで自動保存されます。

- **バックアップの保存場所**: `backups/` フォルダ内
  - ファイル名の例: `backups/exercise-app-backup-20261011_120000.db`

#### 万が一の場合のデータ復元手順（ロールバック）

アップデート後に不具合があった場合や、以前の状態に戻したい場合は以下の手順で復元できます：

1. **サーバーを停止します：**
   ```cmd
   pm2 stop exercise-calendar
   ```
2. **バックアップファイルで復元します：**
   - プロジェクト直下の `exercise-app.db` を削除（または別名に変更）します。
   - `backups/` フォルダから復元したいファイル（例: `exercise-app-backup-20261011_120000.db`）をプロジェクト直下にコピーし、ファイル名を `exercise-app.db` に変更します。
3. **サーバーを再起動します：**
   ```cmd
   pm2 restart exercise-calendar
   ```
4. **ブラウザで確認：**
   - http://localhost:3000 にアクセスし、データが復元されていることを確認します。

---

### 💻 手動コマンドでのアップデート（Git を使用）

手動でコマンドを実行してアップデートする場合は、安全のためサーバーを停止した上で実行することを推奨します：

```bash
# サーバーを一時停止
pm2 stop exercise-calendar

# 最新版を取得 (Fast-forward のみ許可)
git pull --ff-only origin main

# 依存関係をクリーンインストール
npm ci

# データベースを更新（マイグレーションが必要な場合）
npm run init-db

# アプリケーションを再起動
pm2 restart exercise-calendar
pm2 save
```

### 📦 手動更新の場合（ZIP ダウンロード利用時）

1. 新しいバージョンをダウンロードして解凍
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
