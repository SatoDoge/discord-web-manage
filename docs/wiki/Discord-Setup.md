# Discord Setup

Discord Developer Portal で Bot と OAuth2 を設定する手順です。

## 1. アプリケーションの作成

1. [Discord Developer Portal](https://discord.com/developers/applications) を開く
2. **New Application** でアプリを作成
3. **Application ID** を `CLIENT_ID` / `DISCORD_CLIENT_ID` に使用

## 2. Bot の設定

1. 左メニュー **Bot** → **Add Bot**
2. **Token** を Reset して `DISCORD_TOKEN` に設定（再表示不可のため安全に保管）
3. **Privileged Gateway Intents** で以下を有効化:
   - **SERVER MEMBERS INTENT**
   - **MESSAGE CONTENT INTENT**
   - **PRESENCE INTENT**（オンラインメンバー表示に必要）

## 3. OAuth2 の設定

1. 左メニュー **OAuth2**
2. **Client Secret** を `CLIENT_SECRET` に使用
3. **Redirects** に Redirect URI を追加:
   - 開発: `http://localhost:5174/auth/redirect`
   - Docker / 本番: `https://your-domain.example/auth/redirect` または `http://localhost:3000/auth/redirect`
4. `.env` の `REDIRECT_URI` を上記と**完全一致**させる

スコープは `identify` のみ使用します（管理者本人の Discord ユーザー情報取得）。

## 4. Bot をサーバーに招待

1. 左メニュー **OAuth2 → URL Generator**
2. Scopes: `bot`
3. Bot Permissions（例）:
   - Manage Messages / Kick Members / Ban Members
   - Manage Roles（フィルターでのロール付与を使う場合）
   - View Channels / Send Messages / Embed Links / Attach Files
   - Read Message History（メッセージ検索・フィルター）
4. 生成 URL で対象ギルドに招待

## 5. ギルド ID

Discord の開発者モードを有効にし、サーバー名を右クリック → **サーバー ID をコピー** → `DISCORD_GUILD_ID`

## 6. 初回管理者

自分の Discord ユーザー ID を `ADMIN_USER_ID` に設定します。  
Developer Mode で自分のプロフィール → **ユーザー ID をコピー**。

初回ログイン後、Web UI から他の管理者を追加できます（対象ユーザーはギルドメンバーである必要があります）。

## セキュリティ上の注意

- `DISCORD_TOKEN` と `CLIENT_SECRET` は**絶対に**公開リポジトリにコミットしない
- 本番では HTTPS + 適切な `REDIRECT_URI` を使用する
- Bot に付与する権限は必要最小限に留める
