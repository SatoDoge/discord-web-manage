# Docker

Docker / docker compose を使った本番向けの運用方法です。

## 概要

- **単一コンテナ** — API（Hono）+ Discord Bot + ビルド済み Web UI
- **単一ポート** — デフォルト `3000`
- **永続データ** — 名前付きボリューム `app-data` → `/app/serverend/data`

開発時の `npm run dev`（Vite 5174 + API 3000）とは構成が異なります。

## 前提

- Docker Engine と Docker Compose v2
- `.env` がリポジトリルートに存在すること

## セットアップ

```bash
cp .env.example .env
```

Docker 利用時は少なくとも以下を変更してください。

```env
REDIRECT_URI=http://localhost:3000/auth/redirect
```

Discord Developer Portal の OAuth2 Redirects にも同じ URL を登録します。

本番ドメインで運用する場合:

```env
REDIRECT_URI=https://manage.example.com/auth/redirect
PORT=3000
```

## 起動

```bash
docker compose up --build -d
```

- Web UI + API: http://localhost:3000
- ログ確認: `docker compose logs -f app`

## 停止・再起動

```bash
docker compose down        # コンテナ停止（ボリュームは保持）
docker compose restart app
```

## データのバックアップ

永続データは Docker ボリュームに保存されます。

```bash
# ボリューム名を確認
docker volume ls | grep app-data

# 中身を確認（例）
docker run --rm -v discord-web-manage_app-data:/data alpine ls -la /data
```

定期的にボリューム内の JSON をバックアップすることを推奨します。

## イメージのみビルド

```bash
docker build -t discord-web-manage:latest .
```

## 静的ファイル配信

`node dist/main.js` で起動した場合、serverend は `frontend/dist` を **自動的に** 配信します（`SERVE_STATIC` の設定は不要）。

開発時（`tsx watch src/main.ts`）は配信を行わず、Vite（:5174）を使います。

明示的に無効化する場合:

```env
SERVE_STATIC=false
```

## リバースプロキシ（任意）

本番では Caddy / nginx / Traefik 等の前段に置き、HTTPS を終端させることを推薦します。

- プロキシ先: `http://127.0.0.1:3000`
- `REDIRECT_URI` は外部から見える HTTPS URL に合わせる
- Cookie は `SameSite=Lax`（現行実装）— 同一サイト構成を推奨

## トラブルシューティング

| 症状 | 確認事項 |
|---|---|
| 画面が真っ白 | `docker compose logs app` でビルドエラー、`frontend/dist` の有無 |
| OAuth リダイレクトエラー | `REDIRECT_URI` と Discord Portal の一致 |
| Bot オフライン | `DISCORD_TOKEN`、Intent 設定 |
| データが消えた | `docker compose down -v` でボリューム削除していないか |
