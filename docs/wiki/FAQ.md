# FAQ

## 一般

### このプロジェクトは何のためのもの？

Discord サーバーで複数の管理者がバラバラに操作すると、誰がいつ何をしたか追いにくくなります。  
discord-web-manage は **Web UI → Bot 実行 → 操作ログ** という流れで、管理者業務を一元化することを目的としています。

### 複数の Discord サーバーに対応していますか？

いいえ。現状は `DISCORD_GUILD_ID` で **1 ギルド** を指定する設計です。

### SaaS ですか？ セルフホストですか？

セルフホストです。自分の VPS や自宅サーバー、Docker 上で動かします。

## セットアップ

### ログイン時に `oauth_failed` / `not_admin` になる

- `CLIENT_ID` / `CLIENT_SECRET` / `REDIRECT_URI` が正しいか
- Discord Developer Portal の Redirect URI が `.env` と**完全一致**しているか
- `ADMIN_USER_ID` に自分の Discord ユーザー ID が入っているか、または管理者一覧に追加されているか

### Bot がオンラインにならない

- `DISCORD_TOKEN` が正しいか
- Bot の **Privileged Gateway Intents**（Members, Message Content, Presence）が有効か
- Bot が対象ギルドに招待されているか

### AI モデレーションフィルターが動かない

- `OPENAI_API_KEY` が設定されているか
- OpenAI API の利用制限・課金状態

未設定の場合、フィルターは OpenAI 呼び出しを行いません。

## 運用

### データはどこに保存されますか？

`serverend/data/*.json` です。Docker では `app-data` ボリュームにマウントされます。

### バックアップは必要？

はい。JSON ファイルを定期的にコピーしてください。DB エンジンは使っていないため、ファイルごとバックアップするだけで復旧できます。

### 操作ログはいつまで残りますか？

`operationLog.json` は最大 **500 件**（古いものから削除）です。長期保管が必要なら外部にエクスポートする運用を検討してください。

## 開発

### CI/CD はありますか？

現時点ではありません。個人プロジェクトとして手動リリース・手動テストを前提としています。

### テストはありますか？

自動テストは未整備です。変更後は `npm run dev` または Docker で手動確認してください。

### フロントと API を別ポートで開発したい

```bash
npm run dev
```

Vite（5174）が `/api` を 3000 にプロキシします。`REDIRECT_URI` は 5174 側を使ってください。

## セキュリティ

### `.env` を git に含めてもいい？

**いいえ。** `.gitignore` で除外されています。`.env.example` のみコミットしてください。

### 本番で HTTP だけでもいい？

OAuth トークンやセッション Cookie の観点から、**HTTPS 推奨**です。リバースプロキシで TLS 終端してください。

## 貢献・フィードバック

Issue や Pull Request は GitHub リポジトリから受け付けます（公開後）。  
機能要望は [Features](Features) のロードマップも参照してください。
