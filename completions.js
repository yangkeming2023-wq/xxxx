/**
 * DeepSeek 代理 · EdgeOne Pages 边缘函数
 * 放置路径：functions/chat/completions.js  → 对外路由 /chat/completions
 * 作用：网页把请求发到本函数，本函数带上密钥转发到 DeepSeek 官方接口，并把流式回复原样传回。
 * 密钥来源：EdgeOne 控制台里配置的环境变量 DEEPSEEK_KEY（不写在网页源码里，避免被盗刷）。
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 预检请求（浏览器跨域时会先发 OPTIONS）
export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 优先用环境变量里的密钥；若网页仍自带 Authorization 头也允许透传（兼容内测）
  const key = (env && env.DEEPSEEK_KEY) || '';
  const incomingAuth = request.headers.get('Authorization');
  const auth = key ? ('Bearer ' + key) : (incomingAuth || '');

  if (!auth) {
    return new Response(JSON.stringify({ error: '缺少密钥：请在 EdgeOne 环境变量里配置 DEEPSEEK_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const body = await request.text();

  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth },
    body,
  });

  // 原样把上游（含 SSE 流）传回前端，保留 content-type
  const headers = new Headers(CORS);
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'text/event-stream; charset=utf-8');
  return new Response(upstream.body, { status: upstream.status, headers });
}
