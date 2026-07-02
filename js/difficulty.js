/* global */
(function () {
'use strict';

/** 四档难度 — H5 / 微信共用同一套数值 */
const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: '简单',
    icon: '🌱',
    enemyHp: 0.72,
    enemySpeed: 0.82,
    enemyCount: 0.68,
    spawnInterval: 1.22,
    startGoldMul: 1.4,
    livesBonus: 10,
    levelStipendMul: 0.45,
    clearRewardMul: 1.35,
    levelHpScale: 0.82,
    killRewardMul: 1.2,
    waveBonusMul: 1.25,
    scoreMul: 0.85,
    extraWaves: 0,
    maxRoutesWave1: 2,
    tankReplace: 0,
  },
  normal: {
    id: 'normal',
    name: '普通',
    icon: '⚔️',
    enemyHp: 1,
    enemySpeed: 1,
    enemyCount: 1,
    spawnInterval: 1,
    startGoldMul: 1,
    livesBonus: 0,
    levelStipendMul: 0.28,
    clearRewardMul: 1,
    levelHpScale: 1,
    killRewardMul: 1,
    waveBonusMul: 1,
    scoreMul: 1,
    extraWaves: 0,
    maxRoutesWave1: null,
    tankReplace: 0,
  },
  hard: {
    id: 'hard',
    name: '困难',
    icon: '🔥',
    enemyHp: 1.28,
    enemySpeed: 1.12,
    enemyCount: 1.28,
    spawnInterval: 0.86,
    startGoldMul: 0.82,
    livesBonus: -4,
    levelStipendMul: 0.15,
    clearRewardMul: 0.92,
    levelHpScale: 1.18,
    killRewardMul: 0.9,
    waveBonusMul: 0.88,
    scoreMul: 1.3,
    extraWaves: 0,
    maxRoutesWave1: null,
    tankReplace: 0.15,
  },
  hell: {
    id: 'hell',
    name: '地狱',
    icon: '💀',
    enemyHp: 1.68,
    enemySpeed: 1.24,
    enemyCount: 1.55,
    spawnInterval: 0.7,
    startGoldMul: 0.62,
    livesBonus: -8,
    levelStipendMul: 0,
    clearRewardMul: 1.15,
    levelHpScale: 1.38,
    killRewardMul: 0.85,
    waveBonusMul: 0.8,
    scoreMul: 1.75,
    extraWaves: 1,
    maxRoutesWave1: null,
    tankReplace: 0.35,
  },
};

const STORAGE_KEY = 'td3d_difficulty';

function get(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.normal;
}

function getIds() {
  return ['easy', 'normal', 'hard', 'hell'];
}

function loadSaved() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return DIFFICULTIES[v] ? v : 'normal';
  } catch (e) {
    return 'normal';
  }
}

function save(id) {
  if (DIFFICULTIES[id]) localStorage.setItem(STORAGE_KEY, id);
}

function scaleCount(count, mul) {
  if (count <= 0) return 0;
  return Math.max(1, Math.round(count * mul));
}

/** 按难度生成实际波次（敌人数、间隔、地狱额外波） */
function buildWaves(levelConfig, diffId) {
  const d = get(diffId);
  const routeIds = (levelConfig.routes || []).map((r) => r.id);

  let waves = levelConfig.waves.map((w, wi) => ({
    interval: w.interval * d.spawnInterval,
    enemies: w.enemies.map((e) => {
      let type = e.type;
      if (d.tankReplace > 0 && type === 'basic' && Math.random() < d.tankReplace) {
        type = 'tank';
      }
      let count = scaleCount(e.count, d.enemyCount);
      if (d.maxRoutesWave1 && wi === 0 && routeIds.length > d.maxRoutesWave1 && e.route) {
        const allowed = routeIds.slice(0, d.maxRoutesWave1);
        if (allowed.indexOf(e.route) < 0) count = 0;
      }
      return { type, count, route: e.route };
    }).filter((e) => e.count > 0),
  }));

  if (d.extraWaves > 0 && levelConfig.id >= 4 && waves.length > 0) {
    const last = waves[waves.length - 1];
    waves = waves.concat([{
      interval: last.interval * 0.82,
      enemies: last.enemies.map((e) => ({
        type: e.type === 'basic' ? 'fast' : (e.type === 'fast' ? 'tank' : e.type),
        count: Math.max(1, Math.round(e.count * 0.55)),
        route: e.route,
      })),
    }]);
  }

  return waves;
}

function getStartGold(levelConfig, diffId) {
  return Math.floor((levelConfig.startGold || 200) * get(diffId).startGoldMul);
}

function getStartLives(levelConfig, diffId) {
  return Math.max(5, (levelConfig.lives || 20) + get(diffId).livesBonus);
}

function getLevelStipend(levelConfig, diffId) {
  return Math.floor((levelConfig.startGold || 200) * get(diffId).levelStipendMul);
}

function getClearGold(baseGold, diffId) {
  return Math.floor(baseGold * get(diffId).clearRewardMul);
}

function applyThemeIntensity(theme, diffId) {
  const t = Object.assign({}, theme);
  if (diffId === 'hell') {
    t.portal = 0xff0000;
    t.fog = (theme.fog || 0x0a1628);
  } else if (diffId === 'easy') {
    t.build = theme.build;
  }
  return t;
}

window.Difficulty = {
  DIFFICULTIES,
  get,
  getIds,
  loadSaved,
  save,
  buildWaves,
  getStartGold,
  getStartLives,
  getLevelStipend,
  getClearGold,
  applyThemeIntensity,
};
})();
