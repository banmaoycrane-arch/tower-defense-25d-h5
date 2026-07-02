const { Redis } = require('@upstash/redis');

const KEY = 'td3d:leaderboard:v1';
const MAX_STORED = 50;

let memoryStore = [];

function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return Redis.fromEnv();
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function validateEntry(body) {
  if (!body || typeof body !== 'object') return null;
  const name = String(body.name || '匿名勇士').trim().slice(0, 12) || '匿名勇士';
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > 9999999) return null;
  const ts = Number(body.ts) || Date.now();
  return {
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
}

async function loadList(redis) {
  if (redis) {
    const list = await redis.get(KEY);
    return Array.isArray(list) ? list : [];
  }
  return memoryStore.slice();
}

async function saveList(redis, list) {
  const trimmed = list.slice(0, MAX_STORED);
  if (redis) await redis.set(KEY, trimmed);
  else memoryStore = trimmed;
  return trimmed;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const redis = getRedis();
  const persisted = !!redis;

  try {
    if (req.method === 'GET') {
      const list = await loadList(redis);
      list.sort((a, b) => b.score - a.score);
      return res.status(200).json({
        ok: true,
        list: list.slice(0, MAX_STORED),
        persisted,
      });
    }

    if (req.method === 'POST') {
      const entry = validateEntry(req.body);
      if (!entry) return res.status(400).json({ ok: false, error: 'invalid entry' });

      let list = await loadList(redis);
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      list = await saveList(redis, list);
      const rank = list.findIndex((e) => e.ts === entry.ts) + 1;

      return res.status(200).json({
        ok: true,
        rank,
        score: entry.score,
        list: list.slice(0, 10),
        persisted,
      });
    }

    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
};
