# discord-web-manage

Discord サーバーの管理者業務を **Web アプリ + Bot** で一元管理するセルフホスト型ツールです。  
複数の管理者が Discord 上で個別に操作すると起きがちな「誰が何をしたか分からない」問題を、Bot 経由の操作と操作ログで解消することを目的としています。

## 主な機能

- **ダッシュボード** — メンバー数・参加トレンド・フィルター概要
- **メンバー / メッセージ管理** — 一覧、検索、BAN / Kick / ロール付与
- **Bot 運用** — ステータス変更、メッセージ送信（Embed・添付・フォーラム投稿）、Bot 投稿履歴の編集・削除
- **フィルター**
  - **メッセージフィルター** — ワード / 重複(連投) / AIモデレーション(メッセージと画像)
  - **メンバーフィルター** — 名前 / アカウント作成から参加までの時間 / プロフィールのAIモデレーション
- **操作ログ** — 管理者の手動操作と Bot の自動処置を記録

## クイックスタート

### 前提

- Node.js **20** 以上
- Discord アプリケーション（Bot + OAuth2）
- 対象ギルドへの Bot 招待

### 1. リポジトリのセットアップ

```bash
git clone https://github.com/SatoDoge/discord-web-manage.git
cd discord-web-manage
cp .env.example .env
# .env を編集
npm install
```

### 2. 開発

```bash
npm run dev
```

- Web UI: `http://localhost:5174`
- API: `http://localhost:3000`

開発時は`REDIRECT_URI` を `http://localhost:5174/auth/redirect` に設定してください。

### 3. 本番

```bash
npm run build
npm run start
```

- Web UI + API: http://localhost:3000
- `REDIRECT_URI` は `http://localhost:3000/auth/redirect` または公開するエンドポイントへ変更

### 4. Docker

```bash
cp .env.example .env
# REDIRECT_URI を http://localhost:3000/auth/redirect に変更
docker compose up --build -d
```

- Web UI + API: http://localhost:3000
- 永続データ: Docker ボリューム `app-data`（`serverend/data`）


## プロジェクト構成

```
discord-web-manage/
├── frontend/          # Vue 管理画面
├── serverend/         # Hono API + Discord Bot
│   ├── src/
│   └── data/          # ランタイム JSON（git 管理外）
├── docs/wiki/         # Wiki 用ドキュメント
├── Dockerfile
└── docker-compose.yml
```

## ライセンス

[MIT](LICENSE)

フロントエンドの UI テンプレートには [PrimeVue Sakai](https://github.com/primefaces/sakai-vue)（MIT）を使用しています。

## 注意事項

- **シングルギルド** — このプロジェクトは 1 サーバー向けに開発・設計されています
- **OpenAI** — AI モデレーションフィルターは任意です（`OPENAI_API_KEY` 未設定時はスキップ）
