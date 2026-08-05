// 認可URLは環境変数に依存するため、ビルド時ではなくリクエスト時に組み立てる。
// これがないと環境変数未設定の状態でビルドが落ちる。
export const dynamic = "force-dynamic";

const AUTHORIZE_BASE = "https://api.notion.com/v1/oauth/authorize";

function authorizeUrl(): string | null {
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !redirectUri) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    owner: "user",
  });

  return `${AUTHORIZE_BASE}?${params.toString()}`;
}

export default function Home() {
  const url = authorizeUrl();

  return (
    <main>
      <h1>曼荼羅目標管理テンプレート</h1>

      <p className="lead">
        人生の目標を曼荼羅（3×3）で整理し、そのまま日々の Todo まで一本で繋げる
        Notion テンプレートです。中身は空の状態で、あなたのワークスペースに複製されます。
      </p>

      <h2>入っているもの</h2>
      <dl>
        <dt>⛳ テーマ</dt>
        <dd>曼荼羅の9マス（中心＋8領域）。まずここを自分の言葉で埋めます。</dd>

        <dt>🧭 目標</dt>
        <dd>各テーマにぶら下がる具体目標。期限・判定基準・未達ならを記録します。</dd>

        <dt>🪧 Todo</dt>
        <dd>日々の実行。目標に紐づけると、進んでいない目標が一目で分かります。</dd>
      </dl>

      {url ? (
        <>
          <p>
            <a className="cta" href={url}>
              Notion に追加する
            </a>
          </p>
          <p className="note">
            ボタンを押すと Notion の認可画面が開きます。
            <strong>「テンプレートを複製」を選ぶ</strong>と、
            あなたのワークスペースにコピーが作られます。
          </p>
        </>
      ) : (
        <p className="note">現在準備中です。しばらくしてからお試しください。</p>
      )}
    </main>
  );
}
