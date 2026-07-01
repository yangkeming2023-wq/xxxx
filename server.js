/**
 * Wolf 命理 · Zeabur Node 服务
 * 作用：① 把 index.html 发给访问者；② 把网页发来的 AI 请求带上密钥转发到 DeepSeek，并把流式回复原样传回。
 * 密钥来源：Zeabur 环境变量 DEEPSEEK_KEY（不写在网页源码里）。
 */
const express = require('express');
const path = require('path');
const { Readable } = require('stream');

const app = express();
app.use(express.json({ limit: '2mb' }));

// ① 发送网页（index.html 与本文件放在同一目录）
app.use(express.static(path.join(__dirname)));

// ② DeepSeek 代理（SSE 流式）——网页里 BASE_URL 填 '' 时会请求到这里
app.post('/chat/completions', async (req, res) => {
  const key = process.env.DEEPSEEK_KEY || '';
  if (!key) {
    res.status(500).json({ error: '缺少密钥：请在 Zeabur 环境变量里配置 DEEPSEEK_KEY' });
    return;
  }
  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(req.body),
    });
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8');
    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (e) {
    res.status(502).json({ error: '代理请求失败: ' + String(e) });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log('Wolf 命理 running on ' + port));
