# discord-web-manage Wiki

Discord サーバーの管理者業務を Web + Bot で一元管理するためのドキュメントです。

## ページ一覧

| ページ | 説明 |
|---|---|
| [Getting Started](Getting-Started) | 初回セットアップ（開発環境） |
| [Discord Setup](Discord-Setup) | Discord アプリ・Bot・OAuth2 の設定 |
| [Configuration](Configuration) | 環境変数リファレンス |
| [Docker](Docker) | Docker / docker compose での運用 |
| [Features](Features) | 機能一覧と使い方の概要 |
| [FAQ](FAQ) | よくある質問 |

## このプロジェクトについて

**discord-web-manage** は、複数の Discord 管理者が個別に操作することによる「把握の難しさ」を解消するために作られたセルフホスト型管理ツールです。

- 管理者の操作は Web UI 経由で Bot が実行し、**操作ログ**に記録されます
- 自動フィルター（ワード / 重複 / AI モデレーション等）も Bot が処理し、同様にログ化されます
- 1 つの Discord ギルドを `DISCORD_GUILD_ID` で指定して運用します

## リポジトリ

ソースコード: [GitHub リポジトリ](https://github.com/YOUR_USER/discord-web-manage)

> **Wiki の編集方法:** GitHub リポジトリの Wiki タブから各ページを作成し、`docs/wiki/` 内の Markdown をコピーしてください。ファイル名（例: `Getting-Started.md`）が Wiki ページ名（`Getting-Started`）になります。
