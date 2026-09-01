# Configuration

`.env` の環境変数リファレンスです。テンプレートはリポジトリルートの `.env.example` です。

## サーバー

| 変数 | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `PORT` | 否 | `3000` | API / Bot プロセスの待ち受けポート |
| `SERVE_STATIC` | 否 | 未設定 | `true` のときビルド済み Vue を同一ポートで配信（Docker 向け） |

## Discord OAuth2（Web ログイン）

| 変数 | 必須 | 説明 |
|---|---|---|
| `CLIENT_ID` | はい | Discord アプリケーション ID |
| `CLIENT_SECRET` | はい | OAuth2 Client Secret |
| `REDIRECT_URI` | はい | OAuth2 コールバック URL（Developer Portal と一致必須） |
| `ADMIN_USER_ID` | 推奨 | 初回ログインを許可する Discord ユーザー ID |
| `SESSION_EXPIRES_IN` | 否 | セッション有効期間（例: `14d`, `7d`, `12h`） |

## Discord Bot

| 変数 | 必須 | 説明 |
|---|---|---|
| `DISCORD_TOKEN` | はい | Bot トークン |
| `DISCORD_CLIENT_ID` | はい | Bot Application ID |
| `DISCORD_GUILD_ID` | はい | 管理対象ギルド ID（シングルギルド） |

## OpenAI（任意）

| 変数 | 必須 | 説明 |
|---|---|---|
| `OPENAI_API_KEY` | 否 | 設定時のみメッセージ / プロフィールの AI モデレーションフィルターが有効 |

未設定の場合、該当フィルターは OpenAI 呼び出しをスキップします。

## 開発 vs Docker での `REDIRECT_URI`

| 環境 | `REDIRECT_URI` | `SERVE_STATIC` |
|---|---|---|
| `npm run dev` | `http://localhost:5174/auth/redirect` | 不要 |
| Docker / 単一ポート本番 | `http://localhost:3000/auth/redirect`（または本番 URL） | `true` |

Discord Developer Portal の Redirects に、使用する URL を**すべて**登録してください。

## データディレクトリ

`serverend/data/` に以下の JSON が生成されます（git 管理外）。

| ファイル（例） | 内容 |
|---|---|
| `adminUserList.json` | Web 管理者一覧 |
| `memberList.json` | ギルドメンバー |
| `messageList.json` | フィルター対象メッセージ DB |
| `memberJoinList.json` | 参加イベント DB |
| `operationLog.json` | 操作ログ |
| `*FilterSettings.json` | 各種フィルター設定 |
| `sessionData.json` | ログインセッション |
| `botPostedMessage.json` | Bot 投稿履歴 |

Docker では `docker-compose.yml` の `app-data` ボリュームで永続化されます。
