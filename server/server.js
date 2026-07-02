/**
 * 阿里云轻量服务器 — 游戏静态页 + 排行榜 API
 * 启动：npm install && npm start  （默认端口 3000）
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const MAX_STORED = 50;
const WECHAT_APPID = process.env.WECHAT_APPID || '';
const WECHAT_SECRET = process.env.WECHAT_SECRET || '';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'leaderboard.json');
const WEB_ROOT = path.join(__dirname, '..');

const app = express();
app.use(express.json({ limit: '32kb' }));

function cors(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function loadList() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveList(list) {
  ensureDataFile();
  const trimmed = list.slice(0, MAX_STORED);
  fs.writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  return trimmed;
}

function validateEntry(body) {
  if (!body || typeof body !== 'object') return null;
  const name = String(body.name || '未登录').trim().slice(0, 15) || '未登录';
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > 9999999) return null;
  const ts = Number(body.ts) || Date.now();
  const entry = {
    name,
    score: Math.floor(score),
    kills: Math.max(0, Math.floor(Number(body.kills) || 0)),
    level: Math.max(1, Math.floor(Number(body.level) || 1)),
    wave: Math.max(0, Math.floor(Number(body.wave) || 0)),
    victory: !!body.victory,
    reason: String(body.reason || '结束').slice(0, 20),
    date: String(body.date || new Date().toLocaleString('zh-CN')).slice(0, 32),
    ts,
    platform: body.platform === 'wechat' ? 'wechat' : 'h5',
  };
  if (body.difficulty) entry.difficulty = String(body.difficulty).slice(0, 10);
  if (body.difficultyName) entry.difficultyName = String(body.difficultyName).slice(0, 8);
  return entry;
}

function maskPhone(phone) {
  const p = String(phone || '').replace(/\D/g, '');
  if (p.length === 11) return p.slice(0, 3) + '****' + p.slice(7);
  return '用户' + p.slice(-4);
}

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(String(phone || '').replace(/\D/g, ''));
}

let accessTokenCache = { token: '', expiresAt: 0 };

function fetchAccessToken() {
  const now = Date.now();
  if (accessTokenCache.token && accessTokenCache.expiresAt > now + 60000) {
    return Promise.resolve(accessTokenCache.token);
  }
  if (!WECHAT_APPID || !WECHAT_SECRET) {
    return Promise.reject(new Error('wechat not configured'));
  }
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credentials&appid=${encodeURIComponent(WECHAT_APPID)}&secret=${encodeURIComponent(WECHAT_SECRET)}`;
  return fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (!data.access_token) throw new Error(data.errmsg || 'token failed');
      accessTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 7200) * 1000,
      };
      return data.access_token;
    });
}

function exchangeWechatPhoneCode(code) {
  return fetchAccessToken().then((token) => {
    const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(token)}`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then((res) => res.json());
  }).then((data) => {
    if (data.errcode && data.errcode !== 0) {
      throw new Error(data.errmsg || 'phone exchange failed');
    }
    const info = data.phone_info || {};
    const phone = info.purePhoneNumber || info.phoneNumber || '';
    if (!validatePhone(phone)) throw new Error('invalid phone from wechat');
    return phone;
  });
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'tower-defense', time: new Date().toISOString() });
});

app.use('/api/leaderboard', cors);
app.use('/api/auth', cors);

app.post('/api/auth/phone', (req, res) => {
  try {
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    if (!validatePhone(phone)) {
      return res.status(400).json({ ok: false, error: 'invalid phone' });
    }
    res.json({ ok: true, phone, displayName: maskPhone(phone) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post('/api/auth/wechat-phone', (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ ok: false, error: 'missing code' });

  exchangeWechatPhoneCode(code)
    .then((phone) => {
      res.json({ ok: true, phone, displayName: maskPhone(phone) });
    })
    .catch((err) => {
      res.status(503).json({ ok: false, error: String(err.message || err) });
    });
});

app.get('/api/leaderboard', (req, res) => {
  try {
    const list = loadList();
    list.sort((a, b) => b.score - a.score);
    res.json({ ok: true, list: list.slice(0, MAX_STORED), persisted: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post('/api/leaderboard', (req, res) => {
  try {
    const entry = validateEntry(req.body);
    if (!entry) return res.status(400).json({ ok: false, error: 'invalid entry' });

    let list = loadList();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    list = saveList(list);
    const rank = list.findIndex((e) => e.ts === entry.ts) + 1;

    res.json({
      ok: true,
      rank,
      score: entry.score,
      list: list.slice(0, 10),
      persisted: true,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.use(express.static(WEB_ROOT, { index: 'index.html', maxAge: '1h' }));

app.listen(PORT, '0.0.0.0', () => {
  ensureDataFile();
  console.log(`Tower Defense 服务已启动: http://0.0.0.0:${PORT}`);
  console.log(`排行榜 API: http://0.0.0.0:${PORT}/api/leaderboard`);
  if (WECHAT_APPID) console.log('微信手机号登录: 已配置 AppID');
  else console.log('微信手机号登录: 未配置 WECHAT_APPID/WECHAT_SECRET（微信端将用手动输入）');
});
