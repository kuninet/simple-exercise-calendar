# Simple Exercise Calendar 🏃‍♂️

シンプルで使いやすいエクササイズ記録カレンダーアプリです。日々の運動を記録し、継続をサポートします。

## ✨ 特徴

- **シンプルな記録**: 「今日やった！」ボタンで簡単記録
- **視覚的なカレンダー**: 大きな「済」ハンコで達成感アップ
- **複数ユーザー対応**: 家族みんなで使える
- **連続記録表示**: ストリーク機能でモチベーション維持
- **詳細な統計**: 個人・家族の記録統計
- **データ管理**: バックアップ・エクスポート機能
- **レスポンシブデザイン**: PC・スマートフォン・タブレット対応
- **📱 PWAアプリ対応**: iPhone・iPad・Androidでアプリのように使える

## 📱 モバイルアプリとして使用

このアプリは**PWA（Progressive Web App）**対応で、スマートフォンやタブレットにアプリとしてインストールできます。

### iPhone・iPadでの使用方法

1. **Safari**でアプリにアクセス
2. **共有ボタン**（□に↑のアイコン）をタップ
3. **「ホーム画面に追加」**を選択
4. **「追加」**をタップ

### Androidでの使用方法

1. **Chrome**でアプリにアクセス
2. **メニュー**（⋮）をタップ
3. **「ホーム画面に追加」**を選択
4. **「追加」**をタップ

### アプリ化のメリット

- **🚀 高速起動**: ブラウザを開く必要なし
- **📴 オフライン対応**: ネット接続なしでも基本機能が使用可能
- **🎯 フルスクリーン**: ブラウザのUIが非表示でアプリっぽい体験
- **🔄 自動更新**: アプリストア不要で最新版に自動更新
- **💾 データ保存**: 端末にデータが保存され高速アクセス

## 🚀 クイックスタート

### 必要な環境

- Node.js 16.0.0 以上
- npm または yarn

### インストール

1. リポジトリをクローン
```bash
git clone https://github.com/kuninet/simple-exercise-calendar.git
cd simple-exercise-calendar
```

2. 依存関係をインストール
```bash
npm install
```

3. データベースを初期化
```bash
npm run init-db
```

4. サーバーを起動
```bash
npm start
```

5. ブラウザで http://localhost:3000 にアクセス

## 📱 使い方

### 基本的な使い方

1. **ユーザー選択**: 右上のユーザーアイコンから使用するユーザーを選択
2. **運動記録**: 「今日やった！」ボタンで簡単記録
3. **詳細追加**: 日付をクリックして詳細なエクササイズを追加・編集
4. **統計確認**: カレンダー下部で個人・家族の統計を確認

### 📱 モバイル・タブレットでの使い方

**アプリとしてインストール後：**
- ホーム画面のアイコンをタップして起動
- ネイティブアプリと同様の操作感
- オフラインでも基本機能が利用可能
- バックグラウンドで自動更新

**画面サイズ別の最適化：**
- **iPhone**: コンパクトな表示で片手操作しやすい
- **iPad**: 大画面を活かした見やすいレイアウト
- **Android**: 各デバイスサイズに自動対応

### エクササイズの種類

- 🏃 ランニング
- 🚶 ウォーキング  
- 💪 腹筋
- 🤲 腕立て伏せ
- 🦵 スクワット
- 🧘 ヨガ
- 🏊 水泳
- 🚴 サイクリング

### ユーザー管理

- **ユーザー追加**: ユーザー管理画面から新しいユーザーを追加
- **名前変更**: 既存ユーザーの表示名を変更
- **デフォルトエクササイズ**: ユーザーごとにデフォルトのエクササイズを設定

## 🛠️ 開発

### プロジェクト構成

```
simple-exercise-calendar/
├── server.js              # Express サーバー
├── database.js            # データベース初期化
├── package.json           # プロジェクト設定
├── public/                # フロントエンド
│   ├── index.html         # メインHTML
│   ├── app.js             # Vue.js アプリケーション
│   ├── style.css          # スタイルシート
│   └── favicon.ico        # ファビコン
└── backups/               # データベースバックアップ（gitignore対象）
```

### 技術スタック

- **バックエンド**: Node.js + Express
- **データベース**: SQLite3
- **フロントエンド**: Vue.js 3 (CDN)
- **スタイル**: CSS3 (レスポンシブデザイン)
- **PWA**: Service Worker + Web App Manifest
- **オフライン対応**: キャッシュAPI

### API エンドポイント

- `GET /api/users` - ユーザー一覧取得
- `GET /api/exercises` - エクササイズ一覧取得
- `GET /api/records` - 記録一覧取得
- `POST /api/record-day` - 日付記録
- `POST /api/add-exercise` - エクササイズ追加
- `DELETE /api/remove-exercise` - エクササイズ削除
- `GET /api/stats` - 個人統計
- `GET /api/family-stats` - 家族統計
- `GET /api/backup` - データバックアップ
- `GET /api/export` - データエクスポート

### 開発用コマンド

```bash
# データベース初期化
npm run init-db

# サーバー起動
npm start

# 開発モード（ファイル変更時自動再起動）
npx nodemon server.js
```

## 📊 データベース構造

### users テーブル
- `id`: ユーザーID
- `username`: ユーザー名
- `display_name`: 表示名
- `color_theme`: カラーテーマ
- `default_exercise_id`: デフォルトエクササイズID

### exercises テーブル
- `id`: エクササイズID
- `name`: エクササイズ名
- `category`: カテゴリ
- `icon`: アイコン
- `unit`: 単位

### exercise_records テーブル
- `id`: 記録ID
- `user_id`: ユーザーID
- `exercise_id`: エクササイズID
- `record_date`: 記録日
- `is_quick_record`: 簡単記録フラグ
- `created_at`: 作成日時

## 🔧 カスタマイズ

### エクササイズの追加

`database.js` の `exercises` 配列に新しいエクササイズを追加：

```javascript
{
  name: '新しいエクササイズ',
  category: 'カテゴリ',
  icon: '🏃',
  unit: '回'
}
```

### カラーテーマの追加

`app.js` の `getColorForTheme` 関数に新しい色を追加：

```javascript
const colors = {
  // 既存の色...
  newcolor: '#FF5722'
}
```

## 🚀 デプロイ

### Heroku へのデプロイ

1. Heroku CLI をインストール
2. Heroku アプリを作成
```bash
heroku create your-app-name
```

3. 環境変数を設定
```bash
heroku config:set NODE_ENV=production
```

4. デプロイ
```bash
git push heroku main
```

### Docker でのデプロイ

Dockerfile を作成してコンテナ化することも可能です。

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📝 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🙏 謝辞

- Vue.js チーム - 素晴らしいフレームワークの提供
- Express.js チーム - シンプルで強力なWebフレームワーク
- SQLite チーム - 軽量で信頼性の高いデータベース

## 📞 サポート

問題や質問がある場合は、[Issues](https://github.com/kuninet/simple-exercise-calendar/issues) でお知らせください。

---

**Happy Exercising! 🏃‍♂️💪**