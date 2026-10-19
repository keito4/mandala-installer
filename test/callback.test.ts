import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../app/callback/route";

const envKeys = [
  "NOTION_CLIENT_ID",
  "NOTION_CLIENT_SECRET",
  "NOTION_REDIRECT_URI",
] as const;
const originalEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
);

beforeEach(() => {
  process.env.NOTION_CLIENT_ID = "test-client";
  process.env.NOTION_CLIENT_SECRET = "test-secret";
  process.env.NOTION_REDIRECT_URI = "https://installer.example/callback";
  mock.method(console, "error", () => {});
});

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  mock.restoreAll();
});

function mockTokenResponse(body: object, status = 200) {
  return mock.method(
    globalThis,
    "fetch",
    async (..._args: Parameters<typeof fetch>) => Response.json(body, { status }),
  );
}

test("cancelled authorization never exchanges a token", async () => {
  const fetchMock = mockTokenResponse({});
  const response = await GET(
    new NextRequest("https://installer.example/callback?error=access_denied"),
  );
  assert.equal(response.status, 200);
  assert.match(await response.text(), /追加はキャンセルされました/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("missing authorization code returns 400 without calling Notion", async () => {
  const fetchMock = mockTokenResponse({});
  const response = await GET(
    new NextRequest("https://installer.example/callback"),
  );
  assert.equal(response.status, 400);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("missing server configuration returns 500 without calling Notion", async () => {
  delete process.env.NOTION_CLIENT_SECRET;
  const fetchMock = mockTokenResponse({});
  const response = await GET(
    new NextRequest("https://installer.example/callback?code=test-code"),
  );
  assert.equal(response.status, 500);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("token exchange keeps its contract and redirects to the duplicated page", async () => {
  const fetchMock = mockTokenResponse({
    access_token: "test-access-token",
    duplicated_template_id: "01234567-89ab-cdef-0123-456789abcdef",
  });
  const response = await GET(
    new NextRequest("https://installer.example/callback?code=test-code"),
  );
  assert.equal(fetchMock.mock.callCount(), 1);
  const [endpoint, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(endpoint, "https://api.notion.com/v1/oauth/token");
  assert.equal(init?.method, "POST");
  const headers = new Headers(init?.headers);
  assert.equal(
    headers.get("authorization"),
    `Basic ${Buffer.from("test-client:test-secret").toString("base64")}`,
  );
  assert.equal(headers.get("notion-version"), "2026-03-11");
  assert.deepEqual(JSON.parse(String(init?.body)), {
    grant_type: "authorization_code",
    code: "test-code",
    redirect_uri: "https://installer.example/callback",
  });
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://www.notion.so/0123456789abcdef0123456789abcdef",
  );
  assert.doesNotMatch(await response.text(), /test-access-token/);
});

test("failed token exchange returns 502 without exposing the response body", async () => {
  mockTokenResponse({ error: "test-upstream-detail" }, 401);
  const response = await GET(
    new NextRequest("https://installer.example/callback?code=test-code"),
  );
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /test-upstream-detail/);
});

test("authorization without duplication returns the existing retry guidance", async () => {
  mockTokenResponse({ access_token: "test-access-token" });
  const response = await GET(
    new NextRequest("https://installer.example/callback?code=test-code"),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  const body = await response.text();
  assert.match(body, /テンプレートが複製されませんでした/);
  assert.doesNotMatch(body, /test-access-token/);
});
