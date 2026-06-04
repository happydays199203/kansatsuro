# 観察録 v3 デプロイ手順

## 必要なアカウント

- Supabase
- GitHub
- Vercel

## 1. Supabaseでプロジェクトを作る

1. Supabaseにログイン
2. New projectを作成
3. SQL Editorを開く
4. `supabase-schema.sql` の全文を貼り付けて実行
5. Project Settings → API から以下を控える
   - Project URL
   - anon public key

注意：service_role key は絶対に公開しないでください。

## 2. app-config.js を編集する

```js
window.KANSATSURO_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "あなたの anon public key",
  STORAGE_BUCKET: "observation-photos",
  DEFAULT_WORKSPACE_NAME: "観察チーム",
  SHARE_BASE_URL: ""
};
```

最初のデプロイ前は `SHARE_BASE_URL` は空欄で大丈夫です。

## 3. GitHubにアップロード

1. GitHubで新規リポジトリを作成
2. このフォルダ内の全ファイルをアップロード
3. Commit changes

ZIPファイルそのものではなく、中身のファイルをアップロードしてください。

## 4. Vercelで公開

1. Vercel → Add New Project
2. GitHubのリポジトリをImport
3. Framework PresetはOtherまたはStaticとして扱う
4. Build Commandは空欄でOK
5. Output Directoryは空欄または `.`
6. Deploy

## 5. 公開URLを設定

Vercelで発行されたURLを確認したら、GitHub上の `app-config.js` を編集します。

```js
SHARE_BASE_URL: "https://あなたのプロジェクト.vercel.app/"
```

保存するとVercelが自動再デプロイします。

## 6. Supabase AuthのURL設定

Supabase → Authentication → URL Configuration で、Site URLにVercelの公開URLを設定してください。
メール確認ONで使う場合は、Redirect URLsにもVercelのURLを追加します。

## 7. 動作確認

1. VercelのURLを開く
2. アカウント作成
3. ログイン
4. 新しい観察を記録
5. 共有・設定から共有コード/参加URLをコピー
6. 別ブラウザまたは別スマホで別アカウントを作成
7. 共有コードで参加
8. 同じ記録が見えるか確認

## よくあるエラー

### ログインできない
SupabaseのEmail認証が有効か確認してください。最初のテストではConfirm emailをOFFにすると進めやすいです。

### 保存できない
`supabase-schema.sql` を最後まで実行できているか確認してください。

### 写真が表示されない
Storage bucket `observation-photos` が作成されているか確認してください。SQL実行で自動作成されます。

### 共有URLが変
`app-config.js` の `SHARE_BASE_URL` にVercelのURLを入れてください。
