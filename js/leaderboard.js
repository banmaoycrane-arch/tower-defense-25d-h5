/* global LEADERBOARD_CONFIG */
(function () {
'use strict';

const CACHE_KEY = 'td3d_leaderboard_cache_v2';
const PLATFORM = 'h5';

function displayName() {
  if (window.Auth) return window.Auth.getDisplayName();
  return '未登录';
}

function cfg() {
  return window.LEADERBOARD_CONFIG || { apiBase: '', maxDisplay: 10, maxStored: 50 };
}

function getApiUrl() {
  const base = (cfg().apiBase || '').replace(/\/$/, '');
  if (base) return `${base}/api/leaderboard`;
  if (typeof location !== 'undefined' && location.origin && location.protocol.startsWith('http')) {
    return `${location.origin}/api/leaderboard`;
  }
  return '';
}

function calcScore(state, victory) {
  const levelBonus = (state.currentLevel + (victory ? 1 : 0)) * 600;
  const killScore = state.totalKills * 80;
  const goldScore = Math.floor(state.totalGoldEarned * 0.5);
  const lifeScore = state.lives * 150;
  const winBonus = victory ? 8000 : 0;
  const progressBonus = state.currentLevel * state.wave * 40;
  let base = killScore + goldScore + lifeScore + levelBonus + winBonus + progressBonus;
  const diff = window.Difficulty ? window.Difficulty.get(state.difficulty || 'normal') : { scoreMul: 1 };
  return Math.floor(base * diff.scoreMul);
}

function cacheBoard(list) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list.slice(0, cfg().maxStored || 50)));
  } catch (e) { /* ignore */ }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function getPlayerName() {
  return displayName();
}

function setPlayerName(name) {
  if (window.Auth && window.Auth.setStoredPhone) {
    return window.Auth.setStoredPhone(name) ? window.Auth.getDisplayName() : displayName();
  }
  return displayName();
}

function apiRequest(method, body) {
  const url = getApiUrl();
  if (!url) return Promise.resolve(null);

  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
    .then((res) => res.json())
    .catch(() => null);
}

function mergeLocalEntry(list, entry) {
  const merged = list.slice();
  merged.push(entry);
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, cfg().maxStored || 50);
}

function buildEntry(state, victory, reason) {
  const score = calcScore(state, victory);
  const diff = window.Difficulty ? window.Difficulty.get(state.difficulty || 'normal') : { id: 'normal', name: '普通' };
  return {
    name: getPlayerName(),
    score,
    kills: state.totalKills,
    level: state.currentLevel + 1,
    wave: state.wave,
    victory: !!victory,
    reason: reason || (victory ? '通关' : '结束'),
    date: new Date().toLocaleString('zh-CN'),
    ts: Date.now(),
    platform: PLATFORM,
    difficulty: diff.id,
    difficultyName: diff.name,
  };
}

async function fetchBoard() {
  const data = await apiRequest('GET');
  if (data && data.ok && Array.isArray(data.list)) {
    cacheBoard(data.list);
    return data.list;
  }
  return loadCache();
}

async function submitScore(state, victory, reason) {
  const entry = buildEntry(state, victory, reason);

  const data = await apiRequest('POST', entry);
  if (data && data.ok) {
    const list = Array.isArray(data.list) ? data.list : mergeLocalEntry(await fetchBoard(), entry);
    cacheBoard(list);
    return { entry, rank: data.rank || 1, score: entry.score, cloud: true };
  }

  const list = mergeLocalEntry(loadCache(), entry);
  cacheBoard(list);
  const rank = list.findIndex((e) => e.ts === entry.ts) + 1;
  return { entry, rank, score: entry.score, cloud: false };
}

function formatPlatform(platform) {
  return platform === 'wechat' ? '小程序' : 'H5';
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDifficulty(e) {
  const names = { easy: '简单', normal: '普通', hard: '困难', hell: '地狱' };
  return e.difficultyName || names[e.difficulty] || '普通';
}

function formatRow(e, i) {
  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
  const plat = formatPlatform(e.platform);
  const platClass = e.platform === 'wechat' ? 'wechat' : 'h5';
  const diffTag = formatDifficulty(e);
  return `<li><span class="rank">${medal}</span><span class="name">${escapeHtml(e.name)}</span><span class="score">${e.score}</span><span class="platform platform-${platClass}">${plat}·${diffTag}</span></li>`;
}

async function renderLeaderboard(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<li class="empty">加载排行榜…</li>';

  const list = await fetchBoard();
  if (list.length === 0) {
    el.innerHTML = '<li class="empty">暂无记录，开始游戏上榜吧！</li>';
    return;
  }
  el.innerHTML = list.slice(0, cfg().maxDisplay || 10).map(formatRow).join('');
}

function renderLeaderboardSync(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const list = loadCache();
  if (list.length === 0) {
    el.innerHTML = '<li class="empty">暂无记录，开始游戏上榜吧！</li>';
    return;
  }
  el.innerHTML = list.slice(0, cfg().maxDisplay || 10).map(formatRow).join('');
}

window.Leaderboard = {
  calcScore,
  fetchBoard,
  submitScore,
  renderLeaderboard,
  renderLeaderboardSync,
  getPlayerName,
  setPlayerName,
  getApiUrl,
  MAX_ENTRIES: cfg().maxDisplay || 10,
};
})();
