# discord-web-manage

Discord サーバーの管理者業務を **Web アプリ + Bot** で一元管理するセルフホスト型ツールです。  
複数の管理者が Discord 上で個別に操作すると起きがちな「誰が何をしたか分からない」問題を、Bot 経由の操作と操作ログで解消することを目的としています。

## 主な機能

- **ダッシュボード** — メンバー数・参加トレンド・フィルター概要
- **メンバー / メッセージ管理** — 一覧、検索、BAN / Kick / ロール付与
- **Bot 運用** — ステータス変更、メッセージ送信（Embed・添付・フォーラム投稿）、Bot 投稿履歴の編集・削除
- **自動フィルター** — ワード / 重複 / AI モデレーション（メッセージ）、名前 / 参加直後 / プロフィール（メンバー）
- **操作ログ** — 管理者の手動操作と Bot の自動処置を記録
- **Web 管理者** — Discord OAuth2 ログイン、管理者ユーザーの追加・削除
- **i18n** — 日本語 / English

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Frontend | Vue 3, Vite, PrimeVue, Tailwind CSS, vue-i18n |
| Backend | Node.js 20+, Hono, TypeScript, discord.js v14 |
| データ | JSON ファイル（`serverend/data/`，Docker ではボリューム） |

## クイックスタート

### 前提

- Node.js **20** 以上
- Discord アプリケーション（Bot + OAuth2）
- 対象ギルドへの Bot 招待

詳細は [Wiki: はじめに](docs/wiki/Home.md) および [Discord セットアップ](docs/wiki/Discord-Setup.md) を参照してください。

### 1. リポジトリのセットアップ

```bash
git clone https://github.com/YOUR_USER/discord-web-manage.git
cd discord-web-manage
cp .env.example .env
# .env を編集
npm install
```

### 2. 開発モード（フロント + API を別ポート）

```bash
npm run dev
```

- Web UI: http://localhost:5174
- API: http://localhost:3000

`REDIRECT_URI` は `http://localhost:5174/auth/redirect` に設定してください。

### 3. 本番モード（ビルド + 単一ポート）

```bash
npm run build
npm run start
```

- Web UI + API: http://localhost:3000
- `frontend/dist` を serverend が自動配信（`SERVE_STATIC` の設定不要）
- `REDIRECT_URI` は `http://localhost:3000/auth/redirect` に変更

### 4. Docker

```bash
cp .env.example .env
# REDIRECT_URI を http://localhost:3000/auth/redirect に変更
docker compose up --build -d
```

- Web UI + API: http://localhost:3000
- 永続データ: Docker ボリューム `app-data`（`serverend/data`）

## ドキュメント

Wiki 用の Markdown は [`docs/wiki/`](docs/wiki/) に置いています。GitHub Wiki にそのままコピーして使えます。

| ページ | 内容 |
|---|---|
| [Home](docs/wiki/Home.md) | Wiki トップ |
| [Getting Started](docs/wiki/Getting-Started.md) | 詳細なセットアップ手順 |
| [Discord Setup](docs/wiki/Discord-Setup.md) | Bot / OAuth2 の設定 |
| [Configuration](docs/wiki/Configuration.md) | 環境変数一覧 |
| [Docker](docs/wiki/Docker.md) | Docker での運用 |
| [Features](docs/wiki/Features.md) | 機能概要 |
| [FAQ](docs/wiki/FAQ.md) | よくある質問 |

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

- **シングルギルド** — `DISCORD_GUILD_ID` で 1 サーバー向けに設計されています
- **OpenAI** — AI モデレーションフィルターは任意です（`OPENAI_API_KEY` 未設定時はスキップ）
- **データ永続化** — JSON ファイル方式のため、大規模ギルドや複数インスタンス構成には向きません
