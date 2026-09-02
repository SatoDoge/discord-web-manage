# Getting Started

開発環境で discord-web-manage を動かす手順です。

## 必要なもの

- **Node.js 20** 以上
- **npm**（リポジトリルートで workspaces を使用）
- Discord Developer Portal で作成したアプリケーション（Bot + OAuth2）
- 管理対象の Discord サーバー（ギルド）

Bot と OAuth2 の詳細は [Discord Setup](Discord-Setup) を先に読んでください。

## 1. クローンと依存関係

```bash
git clone https://github.com/YOUR_USER/discord-web-manage.git
cd discord-web-manage
npm install
```

## 2. 環境変数

```bash
cp .env.example .env
```

最低限、以下を設定します。

| 変数 | 説明 |
|---|---|
| `CLIENT_ID` | Discord アプリの Client ID |
| `CLIENT_SECRET` | Discord アプリの Client Secret |
| `REDIRECT_URI` | `http://localhost:5174/auth/redirect`（開発時） |
| `ADMIN_USER_ID` | 初回ログインを許可する Discord ユーザー ID |
| `DISCORD_TOKEN` | Bot トークン |
| `DISCORD_CLIENT_ID` | Bot の Application ID（通常 `CLIENT_ID` と同じ） |
| `DISCORD_GUILD_ID` | 管理対象ギルド ID |

全項目は [Configuration](Configuration) を参照してください。

## 3. 開発サーバー起動

```bash
npm run dev
```

- **Web UI:** http://localhost:5174
- **API:** http://localhost:3000（Vite が `/api` をプロキシ）

## 4. 初回ログイン

1. ブラウザで http://localhost:5174 を開く
2. ログイン画面から Discord OAuth2 で認証
3. `ADMIN_USER_ID` に設定したユーザー ID であればログイン成功
4. 以降、設定 → 管理者ユーザー から他の管理者を追加可能

## 5. データの保存場所

ランタイムデータは `serverend/data/` に JSON ファイルとして保存されます（git 管理外）。

- メンバー一覧、メッセージ DB、フィルター設定、操作ログ など
- 初回アクセス時にファイルが自動作成されます

## 本番運用

Docker で単一ポート運用する場合は [Docker](Docker) を参照してください。

## トラブルシューティング

- **ログインできない** → `REDIRECT_URI` が Discord Developer Portal の Redirect URI と完全一致しているか確認
- **Bot がオフライン** → `DISCORD_TOKEN`、Bot の Gateway Intent 設定を確認（[Discord Setup](Discord-Setup)）
- **403 not_admin** → `ADMIN_USER_ID` または管理者ユーザー一覧に自分の ID があるか確認

その他は [FAQ](FAQ) も参照してください。
