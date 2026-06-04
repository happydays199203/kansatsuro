# 観察録 v2（アカウント作成・共有チーム対応）

畑・植物・虫・土・水やりの観察記録を、PC/スマホのWEBブラウザで記録・共有するための静的WEBアプリです。

## 実装済み

- メールアドレス＋パスワードでアカウント作成・ログイン
- 初回ログイン時に共有チームを自動作成
- 共有コードで他の人が同じ観察チームに参加
- 共有チームごとに観察記録を分離
- 写真アップロード
- 観察一覧、今の状態の大きい写真表示、図鑑、質問リスト、まとめ
- Supabase Realtime による他メンバー投稿の自動反映
- Supabase未設定時はローカル保存でデモ利用

## 使うファイル

- `index.html`：画面本体
- `styles.css`：UIデザイン
- `app.js`：アカウント作成・共有・記録機能
- `app-config.js`：Supabase接続設定
- `app-config.example.js`：設定例
- `supabase-schema.sql`：DB、認証連携、共有チーム、権限設定

## 1. Supabase側の準備

1. Supabaseで新規プロジェクトを作成
2. `SQL Editor` を開く
3. `supabase-schema.sql` の全文を貼り付けて実行
4. `Authentication` → `Providers` → `Email` が有効になっていることを確認
5. すぐ試す場合は、メール確認をOFFにすると作成後すぐログインできます

## 2. app-config.js を設定

Supabaseの Project Settings → API から、以下を取得して `app-config.js` に入れます。

```js
window.KANSATSURO_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "あなたの Supabase anon public key",
  STORAGE_BUCKET: "observation-photos",
  DEFAULT_WORKSPACE_NAME: "観察チーム",
  SHARE_BASE_URL: "https://あなたの公開URL/"
};
```

`SHARE_BASE_URL` は、Vercel / Netlify / GitHub Pages などに公開した後のURLを入れてください。空欄でも動きますが、共有URLを正しくコピーするには公開URLを入れるのがおすすめです。

## 3. WEB公開

静的ファイルだけで動くので、以下のどれかで公開できます。

- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages

アップロードするのは、このフォルダ内の全ファイルです。

## 4. 共有の流れ

1. 自分がアカウント作成してログイン
2. 自動で「観察チーム」が作成される
3. 左メニューの「共有・設定」を開く
4. 共有コード、または参加URLをコピー
5. 他の人に送る
6. 相手は自分のアカウント作成後、同じ観察チームに参加できる

## 注意

- このv2では、同じ共有チームに入った人だけが観察記録を閲覧・投稿できます。
- 写真は表示しやすくするためPublic bucketに保存されます。限定公開をさらに強める場合はStorageのRLSをprivate運用に変更してください。
- このチャット内では実際の外部公開・Supabase作成までは行っていません。あなたのSupabaseと公開先アカウントで設定すればWEB上で使えます。
