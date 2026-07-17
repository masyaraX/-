# Tower Defense Web

Canvas APIで動くブラウザ向けタワーディフェンスゲームです。静的ファイルだけで構成しているため、GitHub Pagesでそのまま公開できます。

## GitHub Pages

1. このフォルダの内容をGitHubリポジトリへアップロードします。
2. GitHubの `Settings` -> `Pages` を開きます。
3. `Build and deployment` の `Source` を `GitHub Actions` にします。
4. `main` または `master` にpushすると `.github/workflows/pages.yml` が公開します。
5. 公開URLで `index.html` が起動します。

## データ

ゲームの主要データは [data/game-data.js](data/game-data.js) に分離しています。

- タワー性能
- 敵性能
- マップ定義

プレイヤーの進捗はブラウザの `localStorage` に保存されます。設定画面から進捗リセットができます。

## ローカル起動

[index.html](index.html) をブラウザで開くだけで起動できます。
