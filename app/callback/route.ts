import { NextRequest, NextResponse } from "next/server";

const TOKEN_ENDPOINT = "https://api.notion.com/v1/oauth/token";
const NOTION_VERSION = "2026-03-11";

/**
 * OAuth コールバック。
 *
 * テンプレートの複製そのものは Notion 側が認可時に実行済みで、ここでは
 * 複製先ページの ID を受け取って利用者をそこへ送るだけ。
 * アクセストークンは保存しない（他人のワークスペースの資格情報を持たない）。
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const error = params.get("error");
  if (error) {
    // ユーザーが認可画面でキャンセルした場合など
    return html(
      "追加はキャンセルされました",
      `<p>やり直す場合は <a href="/">最初の画面</a> に戻ってください。</p>`,
    );
  }

  const code = params.get("code");
  if (!code) {
    return html("リクエストが不正です", `<p>認可コードがありません。</p>`, 400);
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("Notion OAuth の環境変数が未設定");
    return html("設定エラー", `<p>時間をおいて試してください。</p>`, 500);
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    // 本文にトークンは含まれないが、念のため中身は出さずステータスだけ残す
    console.error(`Notion token exchange failed: ${response.status}`);
    return html(
      "追加に失敗しました",
      `<p>もう一度 <a href="/">最初から</a> お試しください。</p>`,
      502,
    );
  }

  const data = await response.json();
  const templateId: string | null = data.duplicated_template_id ?? null;

  if (!templateId) {
    // 認可はされたが複製が選ばれなかった（またはテンプレート未登録）
    return html(
      "テンプレートが複製されませんでした",
      `<p>認可画面で「テンプレートを複製」を選んでいただく必要があります。</p>
       <p><a href="/">もう一度試す</a></p>`,
    );
  }

  const pageUrl = `https://www.notion.so/${templateId.replace(/-/g, "")}`;
  return NextResponse.redirect(pageUrl);
}

function html(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>${title}</title></head>
<body><h1>${title}</h1>${body}</body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
