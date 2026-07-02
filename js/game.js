/* global THREE, LEVEL_CONFIGS, CREDITS, GameAudio, Difficulty, Render3D, Auth, Leaderboard */
(function () {
'use strict';

var GRID_SIZE = window.MAP_GRID_SIZE || 20;
var TILE_SIZE = 2;
var MAP_OFFSET = -(GRID_SIZE * TILE_SIZE) / 2 + TILE_SIZE / 2;
var TOTAL_LEVELS = 10;

var TOWER_TYPES = {
  archer: { name: '弓箭塔', cost: 55,  damage: 15, range: 5.0, fireRate: 1.35, color: 0x4caf50, height: 2.2, projectileSpeed: 28 },
  cannon: { name: '火炮塔', cost: 115, damage: 38, range: 4.2, fireRate: 0.72, color: 0xff5722, height: 1.8, splash: 3.0, projectileSpeed: 20 },
  frost:  { name: '冰冻塔', cost: 70,  damage: 11, range: 4.6, fireRate: 1.0,  color: 0x03a9f4, height: 2.0, slow: 0.55, slowDuration: 2.5, projectileSpeed: 24 },
};

var SELL_REFUND_RATE = 0.5;
var HEIGHT_RANGE_BONUS = 1;
var HEIGHT_THRESHOLD = 0.35;

var ENEMY_TYPES = {
  basic: { hp: 70,  speed: 0.92, reward: 12, color: 0xe53935, size: 0.52, name: '普通', icon: '🔴' },
  fast:  { hp: 45,  speed: 2.2,  reward: 18, color: 0xff9800, size: 0.4, name: '快速', icon: '🟠' },
  tank:  { hp: 220, speed: 0.95, reward: 35, color: 0x7b1fa2, size: 0.7, name: '坦克', icon: '🟣' },
};

var TOWER_HIT_COLORS = { archer: '#ffeb3b', cannon: '#ff9800', frost: '#80deea' };

var state = {
  currentLevel: 0, gold: 200, lives: 20, wave: 0,
  playing: false, waveActive: false, gameOver: false, speed: 1,
  selectedTower: 'archer', towers: [], enemies: [], projectiles: [],
  particles: [], areaEffects: [], floatingTexts: [],
  buildSpots: new Map(), routePaths: {}, spawnQueue: [], spawnTimer: 0,
  hoverSpot: null, totalKills: 0, totalGoldEarned: 0, musicOn: false,
  paused: false, sessionScore: 0, difficulty: 'normal', levelWaves: [],
  levelMinHeight: 0,
};

var spotPads = {};
var spotRings = {};
var scene;

var canvas = document.getElementById('game-canvas');
if (!canvas || !window.Render3D || !window.THREE) {
  if (window.Compat && Compat.showError) Compat.showError('3D 引擎未加载', '请刷新页面');
  return;
}
try {
  Render3D.init(canvas);
  scene = Render3D.getScene();
} catch (e) {
  if (window.Compat && Compat.showError) Compat.showError('无法启动 3D', e.message || '');
  return;
}

function getLevel() { return LEVEL_CONFIGS[state.currentLevel]; }
function parsePt(p) { return { gx: p[0], gz: p[1], h: p[2] || 0 }; }
function gridToWorld(gx, gz) { return { x: gx * TILE_SIZE + MAP_OFFSET, z: gz * TILE_SIZE + MAP_OFFSET }; }
function ptToWorld(p) { var w = gridToWorld(p.gx, p.gz); return { x: w.x, y: p.h, z: w.z }; }
function getLiveScore() { return Leaderboard.calcScore(state, false); }

function computeLevelMinHeight(lv, buildSpotList) {
  var minH = Infinity;
  (buildSpotList || []).forEach(function (spot) {
    var h = parsePt(spot).h;
    if (h < minH) minH = h;
  });
  (lv.routes || []).forEach(function (route) {
    (route.points || []).forEach(function (p) {
      var h = parsePt(p).h;
      if (h < minH) minH = h;
    });
  });
  return minH === Infinity ? 0 : minH;
}

function getHeightBonus(y) {
  return y > state.levelMinHeight + HEIGHT_THRESHOLD ? HEIGHT_RANGE_BONUS : 0;
}

function getEffectiveRange(baseRange, y) {
  return baseRange + getHeightBonus(y);
}

function canSellTowers() {
  return state.playing && !state.gameOver && !state.paused && !state.waveActive;
}

function findTowerAtSpot(spotKey) {
  for (var i = 0; i < state.towers.length; i++) {
    if (state.towers[i].spotKey === spotKey) return state.towers[i];
  }
  return null;
}

function clearMap() {
  state.towers.forEach(function (t) { if (t.mesh) scene.remove(t.mesh); });
  state.enemies.forEach(function (e) { if (e.mesh) scene.remove(e.mesh); });
  state.projectiles.forEach(function (p) { if (p.mesh) scene.remove(p.mesh); });
  state.particles.forEach(function (p) { if (p.mesh) scene.remove(p.mesh); });
  state.areaEffects.forEach(function (fx) {
    if (fx.ring) scene.remove(fx.ring);
    if (fx.fill) scene.remove(fx.fill);
  });
  state.towers = []; state.enemies = []; state.projectiles = [];
  state.particles = []; state.areaEffects = []; state.floatingTexts = [];
  state.buildSpots.clear(); state.routePaths = {}; state.hoverSpot = null;
  spotPads = {}; spotRings = {};
  var combatLayer = document.getElementById('combat-text-layer');
  if (combatLayer) combatLayer.innerHTML = '';
  Render3D.clearMap();
  Render3D.clearHover(spotRings);
}

function drawRouteSegments(points, pathColor) {
  for (var i = 0; i < points.length - 1; i++) {
    var a = ptToWorld(parsePt(points[i]));
    var b = ptToWorld(parsePt(points[i + 1]));
    var dx = b.x - a.x, dz = b.z - a.z;
    var segments = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dz * dz) / TILE_SIZE));
    for (var s = 0; s <= segments; s++) {
      var t = s / segments;
      Render3D.addPathTile(a.x + dx * t, a.z + dz * t, a.y + (b.y - a.y) * t, pathColor);
    }
  }
}

function loadLevel(levelIndex) {
  clearMap();
  state.currentLevel = levelIndex;
  var lv = getLevel();
  var theme = Render3D.enrichTheme(Difficulty.applyThemeIntensity(lv.theme, state.difficulty));
  Render3D.setTheme(theme);
  Render3D.resize();
  if (state.musicOn) GameAudio.setTrackForLevel(levelIndex);
  state.levelWaves = Difficulty.buildWaves(lv, state.difficulty);
  Render3D.addGround(GRID_SIZE * TILE_SIZE, theme.ground);

  state.routePaths = {};
  (lv.routes || []).forEach(function (route) {
    state.routePaths[route.id] = route.points.map(function (p) { return ptToWorld(parsePt(p)); });
    drawRouteSegments(route.points, theme.path);
    var spawn = ptToWorld(parsePt(route.points[0]));
    Render3D.addPortal(spawn.x, spawn.z, spawn.y, route.portalColor || theme.portal);
  });

  (lv.bases || []).forEach(function (b) {
    var p = parsePt(b);
    var w = gridToWorld(p.gx, p.gz);
    Render3D.addBase(w.x, w.z, p.h, theme.base);
  });

  var buildSpotList = window.BuildSpots
    ? BuildSpots.generate(lv, GRID_SIZE, {
        seed: lv.id * 1337 + levelIndex,
        minCount: 36,
        maxCount: 50,
        pathDist: 1,
      })
    : (lv.buildSpots || []);
  if (!buildSpotList.length) buildSpotList = lv.buildSpots || [];

  state.levelMinHeight = computeLevelMinHeight(lv, buildSpotList);

  buildSpotList.forEach(function (spot) {
    var p = parsePt(spot);
    var w = gridToWorld(p.gx, p.gz);
    var key = p.gx + ',' + p.gz;
    var highGround = getHeightBonus(p.h) > 0;
    var vis = Render3D.addBuildSpot(key, w.x, w.z, p.h, theme.build, highGround);
    spotPads[key] = vis.pad;
    spotRings[key] = vis.ring;
    state.buildSpots.set(key, {
      gx: p.gx, gz: p.gz, x: w.x, y: p.h, z: w.z,
      pad: vis.pad, occupied: false, highGround: highGround,
    });
  });

  (lv.trees || []).forEach(function (t) {
    var p = parsePt(t.length === 2 ? [t[0], t[1], 0] : t);
    var w = gridToWorld(p.gx, p.gz);
    Render3D.addTree(w.x, w.z, p.h);
  });

  state.wave = 0; state.waveActive = false; state.spawnQueue = [];
  document.getElementById('start-wave-btn').disabled = false;
  updateHUD();
}

function updateHoverVisual() {
  Render3D.clearHover(spotRings);
  if (!state.hoverSpot) return;
  var spot = state.buildSpots.get(state.hoverSpot);
  if (!spot) return;
  if (spot.occupied && canSellTowers()) {
    var tower = findTowerAtSpot(state.hoverSpot);
    if (tower) {
      var refund = Math.floor((tower.costPaid || TOWER_TYPES[tower.type].cost) * SELL_REFUND_RATE);
      Render3D.showSellHint(state.hoverSpot, spot.x, spot.z, spot.y, tower.range, refund);
    }
    return;
  }
  if (spotRings[state.hoverSpot]) spotRings[state.hoverSpot].visible = true;
  if (!spot.occupied) {
    var cfg = TOWER_TYPES[state.selectedTower];
    var effRange = getEffectiveRange(cfg.range, spot.y);
    Render3D.createRangeRing(state.hoverSpot, effRange, state.selectedTower, spot.x, spot.z, spot.y, spot.highGround);
  }
}

function placeTower(spotKey, type) {
  var spot = state.buildSpots.get(spotKey);
  if (!spot || spot.occupied) return false;
  var cfg = TOWER_TYPES[type];
  if (state.gold < cfg.cost) return false;
  state.gold -= cfg.cost;
  spot.occupied = true;
  Render3D.setSpotOccupied(spot.pad, true, spot.highGround);
  var mesh = Render3D.createTowerMesh(type, cfg);
  mesh.position.set(spot.x, spot.y, spot.z);
  scene.add(mesh);
  var tower = {
    type: type, x: spot.x, y: spot.y, z: spot.z, mesh: mesh, cooldown: 0,
    spotKey: spotKey, costPaid: cfg.cost, baseRange: cfg.range,
    range: getEffectiveRange(cfg.range, spot.y), onHighGround: spot.highGround,
  };
  Object.assign(tower, cfg);
  tower.range = getEffectiveRange(cfg.range, spot.y);
  state.towers.push(tower);
  GameAudio.playSFX('place');
  updateHUD();
  return true;
}

function sellTower(spotKey) {
  if (!canSellTowers()) return false;
  var spot = state.buildSpots.get(spotKey);
  if (!spot || !spot.occupied) return false;
  var towerIdx = -1;
  for (var i = 0; i < state.towers.length; i++) {
    if (state.towers[i].spotKey === spotKey) { towerIdx = i; break; }
  }
  if (towerIdx < 0) return false;
  var tower = state.towers[towerIdx];
  var refund = Math.floor((tower.costPaid || TOWER_TYPES[tower.type].cost) * SELL_REFUND_RATE);
  state.gold += refund;
  state.totalGoldEarned += refund;
  scene.remove(tower.mesh);
  state.towers.splice(towerIdx, 1);
  spot.occupied = false;
  Render3D.setSpotOccupied(spot.pad, false, spot.highGround);
  GameAudio.playSFX('place');
  spawnFloatingText(spot.x, spot.y + 1.2, spot.z, '+' + refund + '💰', '#ffd54f', 'reward');
  updateHUD();
  return true;
}

function spawnFloatingText(x, y, z, text, color, kind) {
  state.floatingTexts.push({ x: x, y: y, z: z, text: text, color: color, kind: kind || 'damage', life: 1.15, maxLife: 1.15, vy: 1.8 });
}

function updateCombatTexts(dt) {
  var layer = document.getElementById('combat-text-layer');
  if (!layer) return;
  layer.innerHTML = '';
  state.floatingTexts = state.floatingTexts.filter(function (t) {
    t.life -= dt; t.y += t.vy * dt;
    if (t.life <= 0) return false;
    var scr = Render3D.worldToScreen(t.x, t.y, t.z);
    if (!scr.visible) return true;
    var el = document.createElement('div');
    el.className = 'combat-float ' + t.kind;
    el.textContent = t.text;
    el.style.left = scr.x + 'px'; el.style.top = scr.y + 'px';
    el.style.color = t.color;
    el.style.opacity = String(Math.min(1, t.life / (t.maxLife * 0.85)));
    layer.appendChild(el);
    return true;
  });
}

function getEnemyScale() { return 1 + state.currentLevel * 0.1; }

function spawnEnemy(type, routeId) {
  var cfg = ENEMY_TYPES[type];
  var diff = Difficulty.get(state.difficulty);
  var routeIds = Object.keys(state.routePaths);
  var rid = routeId && state.routePaths[routeId] ? routeId : routeIds[0];
  var pathWorld = state.routePaths[rid];
  if (!pathWorld || pathWorld.length < 2) return;
  var start = pathWorld[0];
  var mesh = Render3D.createEnemyMesh(type, cfg);
  mesh.position.set(start.x, start.y + cfg.size, start.z);
  scene.add(mesh);
  var hp = cfg.hp * getEnemyScale() * diff.levelHpScale * diff.enemyHp;
  state.enemies.push({
    type: type, hp: hp, maxHp: hp,
    speed: cfg.speed * (1 + state.currentLevel * 0.012) * diff.enemySpeed,
    reward: Math.floor((cfg.reward + state.currentLevel * 3) * diff.killRewardMul),
    mesh: mesh, pathWorld: pathWorld, pathIndex: 0, pathProgress: 0,
    slowTimer: 0, slowFactor: 1, alive: true, hitFlash: 0,
    bodyMat: mesh.userData.bodyMat || mesh.material,
    bobPhase: mesh.userData.bobPhase || 0,
  });
}

function updateEnemyVisuals(enemy, dt) {
  if (!enemy.bodyMat) return;
  if (enemy.hitFlash > 0) {
    enemy.hitFlash -= dt;
    enemy.bodyMat.emissive.setHex(0xffffff);
    enemy.bodyMat.emissiveIntensity = 0.7;
  } else if (enemy.slowTimer > 0) {
    enemy.bodyMat.emissive.setHex(0x03a9f4);
    enemy.bodyMat.emissiveIntensity = 0.45;
    enemy.bodyMat.color.setHex(ENEMY_TYPES[enemy.type].color);
  } else {
    enemy.bodyMat.emissive.setHex(ENEMY_TYPES[enemy.type].color);
    enemy.bodyMat.emissiveIntensity = 0.22;
    enemy.bodyMat.color.setHex(ENEMY_TYPES[enemy.type].color);
  }
}

function updateEnemy(enemy, dt) {
  if (!enemy.alive) return;
  if (enemy.slowTimer > 0) { enemy.slowTimer -= dt; if (enemy.slowTimer <= 0) enemy.slowFactor = 1; }
  enemy.pathProgress += enemy.speed * enemy.slowFactor * dt;
  var path = enemy.pathWorld;
  while (enemy.pathProgress >= 1 && enemy.pathIndex < path.length - 1) {
    enemy.pathProgress -= 1; enemy.pathIndex++;
  }
  if (enemy.pathIndex >= path.length - 1) {
    killEnemy(enemy, false);
    state.lives--;
    GameAudio.playSFX('hurt');
    updateHUD();
    if (state.lives <= 0) finishRun(false);
    return;
  }
  var from = path[enemy.pathIndex], to = path[enemy.pathIndex + 1], t = enemy.pathProgress;
  var cfg = ENEMY_TYPES[enemy.type];
  enemy.mesh.position.x = from.x + (to.x - from.x) * t;
  enemy.mesh.position.z = from.z + (to.z - from.z) * t;
  enemy.mesh.position.y = from.y + (to.y - from.y) * t + cfg.size;
  enemy.mesh.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
  if (enemy.bobPhase != null) {
    enemy.bobPhase += dt * 5;
    var bob = Math.sin(enemy.bobPhase) * 0.07;
    if (enemy.mesh.userData.body) enemy.mesh.userData.body.position.y = bob;
  }
  updateEnemyVisuals(enemy, dt);
}

function killEnemy(enemy, giveReward) {
  if (giveReward === undefined) giveReward = true;
  if (!enemy.alive) return;
  enemy.alive = false;
  if (giveReward) {
    state.gold += enemy.reward;
    state.totalGoldEarned += enemy.reward;
    state.totalKills++;
    GameAudio.playSFX('kill');
    spawnParticles(enemy.mesh.position.x, enemy.mesh.position.y, enemy.mesh.position.z, ENEMY_TYPES[enemy.type].color, 8);
  }
  scene.remove(enemy.mesh);
  updateHUD();
}

function damageEnemy(enemy, dmg, meta) {
  if (!enemy.alive) return false;
  meta = meta || {};
  var dealt = Math.min(Math.ceil(dmg), Math.ceil(enemy.hp));
  enemy.hp -= dmg;
  enemy.hitFlash = 0.12;
  var pos = enemy.mesh.position;
  spawnFloatingText(pos.x, pos.y + 0.5, pos.z, '-' + dealt, TOWER_HIT_COLORS[meta.towerType] || '#ff5252', 'damage');
  updateEnemyVisuals(enemy, 0);
  if (enemy.hp <= 0) { killEnemy(enemy); return true; }
  return false;
}

function applySlow(enemy, slowFactor, slowDuration) {
  if (!enemy.alive) return;
  enemy.slowFactor = slowFactor;
  enemy.slowTimer = Math.max(enemy.slowTimer || 0, slowDuration);
  var pos = enemy.mesh.position;
  spawnFloatingText(pos.x, pos.y + 0.6, pos.z, '减速' + Math.round((1 - slowFactor) * 100) + '%', '#4fc3f7', 'slow');
}

function fireProjectile(tower, target) {
  var mesh = Render3D.createProjectileMesh(tower.type);
  mesh.position.set(tower.x, tower.y + tower.height + 0.4, tower.z);
  scene.add(mesh);
  if (tower.type === 'cannon') GameAudio.playSFX('cannon_fire');
  else if (tower.type === 'frost') GameAudio.playSFX('frost_fire');
  else GameAudio.playSFX('archer_fire');
  state.projectiles.push({
    mesh: mesh, target: target, speed: tower.projectileSpeed, damage: tower.damage,
    type: tower.type, splash: tower.splash || 0, slow: tower.slow || 0,
    slowDuration: tower.slowDuration || 0, alive: true,
  });
}

function updateProjectile(proj, dt) {
  if (!proj.alive || !proj.target.alive) { proj.alive = false; scene.remove(proj.mesh); return; }
  var tp = proj.target.mesh.position;
  var dx = tp.x - proj.mesh.position.x, dy = tp.y - proj.mesh.position.y, dz = tp.z - proj.mesh.position.z;
  var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 0.35) { hitTarget(proj); return; }
  var step = proj.speed * dt;
  proj.mesh.position.x += (dx / dist) * step;
  proj.mesh.position.y += (dy / dist) * step;
  proj.mesh.position.z += (dz / dist) * step;
  if (proj.mesh.lookAt) proj.mesh.lookAt(tp);
  if (proj.mesh.userData && proj.mesh.userData.spin) {
    proj.mesh.rotation.z += dt * 8;
  }
}

function spawnAreaEffect(x, y, z, radius, type) {
  var ringColor = type === 'cannon' ? 0xff5722 : 0x4fc3f7;
  var ring = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 0.25, 36),
    new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, y + 0.16, z);
  scene.add(ring);
  state.areaEffects.push({ type: type, radius: radius, ring: ring, life: 0.65, maxLife: 0.65, x: x, y: y, z: z });
}

function updateAreaEffects(dt) {
  state.areaEffects = state.areaEffects.filter(function (fx) {
    fx.life -= dt;
    var t = 1 - Math.max(0, fx.life / fx.maxLife);
    if (fx.ring) {
      var sc = fx.radius * (0.15 + t);
      fx.ring.scale.set(sc, sc, sc);
      fx.ring.material.opacity = (1 - t) * 0.85;
    }
    if (fx.life <= 0) { if (fx.ring) scene.remove(fx.ring); return false; }
    return true;
  });
}

function hitTarget(proj) {
  var towerType = proj.type || 'archer';
  var p = proj.mesh.position;
  if (proj.splash > 0) {
    spawnAreaEffect(p.x, p.y, p.z, proj.splash, 'cannon');
    GameAudio.playSFX('cannon_hit');
    state.enemies.forEach(function (e) {
      if (!e.alive) return;
      var d = Math.hypot(e.mesh.position.x - p.x, e.mesh.position.z - p.z);
      if (d <= proj.splash) damageEnemy(e, proj.damage * (1 - d / proj.splash * 0.5), { towerType: towerType });
    });
    spawnParticles(p.x, p.y, p.z, 0xff5722, 10);
  } else {
    if (proj.target.alive) {
      damageEnemy(proj.target, proj.damage, { towerType: towerType });
      if (proj.slow > 0 && proj.target.alive) {
        spawnAreaEffect(p.x, p.y, p.z, 1.5, 'frost');
        GameAudio.playSFX('frost_hit');
        applySlow(proj.target, proj.slow, proj.slowDuration);
      }
    }
    if (proj.slow <= 0) spawnParticles(p.x, p.y, p.z, proj.type === 'frost' ? 0x80deea : 0xffeb3b, 4);
  }
  proj.alive = false;
  scene.remove(proj.mesh);
}

function spawnParticles(x, y, z, color, count) {
  for (var i = 0; i < (count || 6); i++) {
    var mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 })
    );
    mesh.position.set(x, y, z);
    scene.add(mesh);
    state.particles.push({
      mesh: mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4),
      life: 0.55,
    });
  }
}

function updateParticles(dt) {
  state.particles = state.particles.filter(function (p) {
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.mesh); return false; }
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 6 * dt;
    p.mesh.material.opacity = p.life / 0.55;
    return true;
  });
}

function updateTowers(dt) {
  state.towers.forEach(function (tower) {
    tower.cooldown -= dt;
    if (tower.cooldown > 0) return;
    var closest = null, closestDist = Infinity;
    state.enemies.forEach(function (enemy) {
      if (!enemy.alive) return;
      var ep = enemy.mesh.position;
      var d = Math.hypot(ep.x - tower.x, ep.z - tower.z);
      if (d <= tower.range && d < closestDist) { closest = enemy; closestDist = d; }
    });
    if (closest) {
      fireProjectile(tower, closest);
      tower.cooldown = 1 / tower.fireRate;
      tower.mesh.rotation.y = Math.atan2(closest.mesh.position.x - tower.x, closest.mesh.position.z - tower.z);
    }
  });
}

function startWave() {
  if (state.waveActive || state.gameOver || !state.playing || state.paused) return;
  var lv = getLevel();
  var waves = state.levelWaves.length ? state.levelWaves : lv.waves;
  if (state.wave >= waves.length) return;
  state.wave++; state.waveActive = true;
  var waveCfg = waves[state.wave - 1];
  var routeIds = lv.routes.map(function (r) { return r.id; });
  state.spawnQueue = [];
  waveCfg.enemies.forEach(function (e, ei) {
    for (var i = 0; i < e.count; i++) {
      state.spawnQueue.push({ type: e.type, route: e.route || routeIds[(i + ei) % routeIds.length], interval: waveCfg.interval });
    }
  });
  state.spawnTimer = 0;
  updateHUD();
  document.getElementById('start-wave-btn').disabled = true;
}

function updateSpawning(dt) {
  if (!state.waveActive) return;
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      var next = state.spawnQueue.shift();
      spawnEnemy(next.type, next.route);
      state.spawnTimer = next.interval;
      updateHUD();
    }
  }
  if (state.spawnQueue.length === 0 && state.enemies.filter(function (e) { return e.alive; }).length === 0) {
    state.waveActive = false;
    var diff = Difficulty.get(state.difficulty);
    var bonus = Math.floor((20 + state.wave * 8 + state.currentLevel * 5) * diff.waveBonusMul);
    state.gold += bonus; state.totalGoldEarned += bonus;
    updateHUD();
    document.getElementById('start-wave-btn').disabled = false;
    var lv = getLevel();
    var waves = state.levelWaves.length ? state.levelWaves : lv.waves;
    if (state.wave >= waves.length) onLevelClear();
  }
}

function onLevelClear() {
  state.playing = false;
  var lv = getLevel(), diff = Difficulty.get(state.difficulty), reward = lv.clearReward;
  var clearGold = Difficulty.getClearGold(reward.gold, state.difficulty);
  state.gold += clearGold; state.totalGoldEarned += clearGold;
  state.lives = Math.min(state.lives + 3, Difficulty.getStartLives(lv, state.difficulty) + 5);
  GameAudio.playSFX('level');
  if (state.currentLevel >= TOTAL_LEVELS - 1) { finishRun(true, '全通关'); return; }
  document.getElementById('level-clear-title').textContent = '🎊 第 ' + lv.id + ' 关通关！';
  document.getElementById('level-clear-desc').textContent = reward.title + ' — ' + lv.name + ' · ' + diff.icon + diff.name;
  document.getElementById('level-clear-reward').textContent = '+' + clearGold + '💰 ' + reward.desc;
  document.getElementById('level-clear-screen').classList.remove('hidden');
}

function nextLevel() {
  document.getElementById('level-clear-screen').classList.add('hidden');
  state.currentLevel++; state.playing = true; state.gameOver = false;
  var lv = getLevel(), stipend = Difficulty.getLevelStipend(lv, state.difficulty);
  state.gold += stipend; state.totalGoldEarned += stipend;
  loadLevel(state.currentLevel);
  if (state.musicOn) GameAudio.setTrackForLevel(state.currentLevel);
}

function saveRunScore(victory, reason) {
  return Leaderboard.submitScore(state, victory, reason).then(function (result) {
    state.sessionScore = result.score;
    Leaderboard.renderLeaderboard('leaderboard-list');
    Leaderboard.renderLeaderboard('leaderboard-list-start');
    return result;
  });
}

function finishRun(victory, reason) {
  state.gameOver = true; state.playing = false; state.waveActive = false;
  saveRunScore(victory, reason).then(function (result) {
    if (victory) showVictory(result);
    else {
      var lv = getLevel();
      document.getElementById('result-title').textContent = '💀 基地被攻破';
      document.getElementById('result-desc').textContent = '第 ' + lv.id + ' 关 · 得分 ' + result.score;
      document.getElementById('gameover-screen').classList.remove('hidden');
    }
  });
}

function showVictory(result) {
  GameAudio.playSFX('win');
  var list = document.getElementById('credits-list');
  list.innerHTML = '';
  CREDITS.forEach(function (line) {
    var li = document.createElement('li'); li.textContent = line; list.appendChild(li);
  });
  document.getElementById('victory-stats').textContent = '击杀 ' + state.totalKills + ' · 得分 ' + (result ? result.score : 0);
  Leaderboard.renderLeaderboard('leaderboard-list-victory');
  document.getElementById('victory-screen').classList.remove('hidden');
}

function setOverlayMode(active) { if (canvas) canvas.style.pointerEvents = active ? 'none' : 'auto'; }

function showStartScreen() {
  state.playing = false; state.gameOver = false; state.paused = false;
  setOverlayMode(true);
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('level-clear-screen').classList.add('hidden');
  document.getElementById('victory-screen').classList.add('hidden');
  document.getElementById('exit-screen').classList.add('hidden');
  Leaderboard.renderLeaderboard('leaderboard-list-start');
  if (window.Auth && Auth.showLoginHint) Auth.showLoginHint('');
}

function startGame() {
  var lv0 = LEVEL_CONFIGS[0];
  state.difficulty = Difficulty.loadSaved();
  state.currentLevel = 0;
  state.gold = Difficulty.getStartGold(lv0, state.difficulty);
  state.lives = Difficulty.getStartLives(lv0, state.difficulty);
  state.wave = 0; state.playing = true; state.waveActive = false; state.gameOver = false;
  state.paused = false; state.speed = 1; state.totalKills = 0; state.totalGoldEarned = 0;
  state.sessionScore = 0; state.spawnQueue = []; state.spawnTimer = 0;
  ['start-screen', 'gameover-screen', 'level-clear-screen', 'victory-screen', 'exit-screen'].forEach(function (id) {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('speed-btn').textContent = '⏩ 加速';
  setOverlayMode(false);
  if (state.musicOn) GameAudio.setTrackForLevel(0);
  loadLevel(0);
}

function updateHoverAt(clientX, clientY) {
  if (!state.playing || state.gameOver || state.paused) return;
  var key = Render3D.pickBuildSpot(clientX, clientY, spotPads);
  if (key) {
    var spot = state.buildSpots.get(key);
    if (spot && spot.occupied && !canSellTowers()) key = null;
  }
  if (key !== state.hoverSpot) {
    state.hoverSpot = key;
    updateHoverVisual();
  }
}

function onClick() {
  if (!state.playing || state.gameOver || !state.hoverSpot || state.paused) return;
  var spot = state.buildSpots.get(state.hoverSpot);
  if (!spot) return;
  if (spot.occupied) {
    if (canSellTowers()) sellTower(state.hoverSpot);
    return;
  }
  placeTower(state.hoverSpot, state.selectedTower);
}

function updateHUD() {
  var lv = getLevel(), diff = Difficulty.get(state.difficulty);
  var waves = state.levelWaves.length ? state.levelWaves : lv.waves;
  document.getElementById('level').textContent = lv.id;
  document.getElementById('map-name').textContent = lv.name;
  document.getElementById('gold').textContent = state.gold;
  document.getElementById('lives').textContent = state.lives;
  document.getElementById('wave').textContent = state.wave;
  document.getElementById('wave-max').textContent = waves.length;
  document.getElementById('score').textContent = getLiveScore();
  var diffEl = document.getElementById('difficulty-tag');
  if (diffEl) diffEl.textContent = diff.icon + diff.name;
  document.getElementById('route-info').textContent = (lv.routes ? lv.routes.length : 1) + '路' + (lv.bases ? lv.bases.length : 1) + '口';
  document.getElementById('enemies-left').textContent = state.enemies.filter(function (e) { return e.alive; }).length + state.spawnQueue.length;
  document.querySelectorAll('.tower-btn').forEach(function (btn) {
    btn.classList.toggle('disabled', state.gold < TOWER_TYPES[btn.dataset.tower].cost);
  });
  var gapHint = document.getElementById('wave-gap-hint');
  if (gapHint) {
    if (canSellTowers() && state.towers.length > 0) {
      gapHint.textContent = '⏸ 波次间隙：点击已有塔可拆除（退 50% 金币）';
      gapHint.classList.remove('hidden');
    } else {
      gapHint.classList.add('hidden');
    }
  }
}

function toggleMusic() {
  state.musicOn = GameAudio.toggle();
  document.getElementById('music-btn').textContent = state.musicOn ? '🔊' : '🔇';
  if (state.musicOn) GameAudio.setTrackForLevel(state.currentLevel);
}

function requestExit() {
  if (!state.playing || state.gameOver) { showStartScreen(); return; }
  state.paused = true;
  document.getElementById('exit-score-preview').textContent = '当前得分：' + getLiveScore() + ' 分';
  document.getElementById('exit-screen').classList.remove('hidden');
}

function confirmExit() {
  GameAudio.playSFX('exit');
  document.getElementById('exit-screen').classList.add('hidden');
  saveRunScore(false, '中途退出').then(function () { state.paused = false; showStartScreen(); });
}

function cancelExit() {
  state.paused = false;
  document.getElementById('exit-screen').classList.add('hidden');
}

var lastTime = 0;
function animate(time) {
  requestAnimationFrame(animate);
  var rawDt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  var dt = rawDt * state.speed;
  if (state.playing && !state.gameOver && !state.paused) {
    updateSpawning(dt);
    state.enemies.forEach(function (e) { updateEnemy(e, dt); });
    state.enemies = state.enemies.filter(function (e) { return e.alive; });
    updateTowers(dt);
    state.projectiles.forEach(function (p) { updateProjectile(p, dt); });
    state.projectiles = state.projectiles.filter(function (p) { return p.alive; });
    updateParticles(dt);
    updateAreaEffects(dt);
  }
  Render3D.animateMap(rawDt);
  updateCombatTexts(rawDt);
  Render3D.render();
}

window.addEventListener('resize', function () { Render3D.resize(); });

canvas.addEventListener('mousemove', function (e) { updateHoverAt(e.clientX, e.clientY); });
var VIEW_FACE_LABELS = ['↗ 东北', '↘ 东南', '↙ 西南', '↖ 西北'];

function updateViewFaceLabel() {
  var el = document.getElementById('view-face-label');
  if (!el || !window.Render3D || !Render3D.getViewFace) return;
  var face = Render3D.getViewFace();
  el.textContent = VIEW_FACE_LABELS[face] || '↗';
  el.title = '观察方位：' + (VIEW_FACE_LABELS[face] || '');
}

function bindViewRotate() {
  var left = document.getElementById('view-rotate-left');
  var right = document.getElementById('view-rotate-right');
  if (left) {
    left.addEventListener('click', function () {
      Render3D.rotateView(-1);
      updateViewFaceLabel();
    });
  }
  if (right) {
    right.addEventListener('click', function () {
      Render3D.rotateView(1);
      updateViewFaceLabel();
    });
  }
  window.addEventListener('keydown', function (e) {
    if (!state.playing || state.gameOver || state.paused) return;
    if (e.key === 'q' || e.key === 'Q' || e.key === '[') {
      Render3D.rotateView(-1);
      updateViewFaceLabel();
    } else if (e.key === 'e' || e.key === 'E' || e.key === ']') {
      Render3D.rotateView(1);
      updateViewFaceLabel();
    }
  });
  updateViewFaceLabel();
}

bindViewRotate();

canvas.addEventListener('click', onClick);

/* 固定 2.5D 视角：可缩放，不可旋转 */
var touchState = { start: null, moved: false, pinch: 0 };

canvas.addEventListener('wheel', function (e) {
  e.preventDefault();
  var step = e.deltaY > 0 ? 0.10 : -0.10;
  if (e.deltaMode === 1) step *= 8;
  Render3D.setZoom(step);
}, { passive: false });

canvas.addEventListener('touchstart', function (e) {
  if (e.touches.length === 1) {
    var t = e.touches[0];
    touchState.start = { x: t.clientX, y: t.clientY, time: Date.now() };
    touchState.moved = false;
    updateHoverAt(t.clientX, t.clientY);
  } else if (e.touches.length === 2) {
    touchState.start = null;
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    touchState.pinch = Math.hypot(dx, dy);
  }
}, { passive: true });

canvas.addEventListener('touchmove', function (e) {
  if (e.touches.length === 1 && touchState.start) {
    var t = e.touches[0];
    if (Math.hypot(t.clientX - touchState.start.x, t.clientY - touchState.start.y) > 10) touchState.moved = true;
    else updateHoverAt(t.clientX, t.clientY);
  } else if (e.touches.length === 2 && touchState.pinch > 0) {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    var d = Math.hypot(dx, dy);
    Render3D.setZoom((touchState.pinch - d) * 0.004);
    touchState.pinch = d;
    touchState.start = null;
  }
}, { passive: true });

canvas.addEventListener('touchend', function (e) {
  if (e.touches.length > 0) return;
  if (touchState.start && !touchState.moved && Date.now() - touchState.start.time < 400) {
    updateHoverAt(touchState.start.x, touchState.start.y);
    onClick();
  }
  touchState.start = null; touchState.moved = false; touchState.pinch = 0;
});

document.querySelectorAll('.tower-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tower-btn').forEach(function (b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    state.selectedTower = btn.dataset.tower;
    updateHoverVisual();
  });
});

document.getElementById('start-wave-btn').addEventListener('click', startWave);
document.getElementById('speed-btn').addEventListener('click', function () {
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 3 : 1;
  document.getElementById('speed-btn').textContent = state.speed === 1 ? '⏩ 加速' : '⏩ x' + state.speed;
});
document.getElementById('play-btn').addEventListener('click', function () {
  Auth.ensurePhoneLogin().then(startGame).catch(function () {});
});
document.getElementById('restart-btn').addEventListener('click', function () {
  Auth.ensurePhoneLogin().then(startGame).catch(function () {});
});
document.getElementById('play-again-btn').addEventListener('click', function () {
  Auth.ensurePhoneLogin().then(startGame).catch(function () {});
});
document.getElementById('next-level-btn').addEventListener('click', nextLevel);
document.getElementById('music-btn').addEventListener('click', toggleMusic);
document.getElementById('music-cycle-btn').addEventListener('click', function () {
  if (state.musicOn) { GameAudio.cycleTrack(); updateHUD(); }
});
document.getElementById('exit-btn').addEventListener('click', requestExit);
document.getElementById('confirm-exit-btn').addEventListener('click', confirmExit);
document.getElementById('cancel-exit-btn').addEventListener('click', cancelExit);

var DIFF_DESC = {
  easy: '简单：敌人更少更弱，金币更多',
  normal: '普通：标准体验，适合大多数玩家',
  hard: '困难：敌人更强更快，初始资源减少',
  hell: '地狱：极限挑战，额外加波',
};

function initDifficultySelector() {
  var container = document.getElementById('difficulty-btns');
  var descEl = document.getElementById('difficulty-desc');
  if (!container) return;
  var selected = Difficulty.loadSaved();
  state.difficulty = selected;
  Difficulty.getIds().forEach(function (id) {
    var d = Difficulty.get(id);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'difficulty-btn' + (id === selected ? ' selected' : '');
    btn.dataset.diff = id;
    btn.textContent = d.icon + ' ' + d.name;
    btn.addEventListener('click', function () {
      selected = id; state.difficulty = id; Difficulty.save(id);
      container.querySelectorAll('.difficulty-btn').forEach(function (b) {
        b.classList.toggle('selected', b.dataset.diff === id);
      });
      if (descEl) descEl.textContent = DIFF_DESC[id] || '';
    });
    container.appendChild(btn);
  });
  if (descEl) descEl.textContent = DIFF_DESC[selected] || '';
}

initDifficultySelector();
Auth.bindPhoneInput();
setOverlayMode(true);
loadLevel(0);
updateHUD();
Leaderboard.renderLeaderboard('leaderboard-list-start');

(function bindViewportInset() {
  /**
   * 设备档位（按用户常用屏幕）：
   * phone       — 6.5 寸手机  ≤600px
   * tablet      — 10 寸平板竖屏
   * tablet-landscape — 10 寸平板横屏
   * laptop      — 14 寸笔记本 901–1599px
   * desktop     — 27 寸台式   ≥1600px
   */
  function detectDevice(w, h) {
    var landscape = w > h;
    var touchPrimary = window.matchMedia('(pointer: coarse)').matches;
    var hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (w <= 600) return 'phone';

    if (touchPrimary && w <= 1024) {
      return landscape ? 'tablet-landscape' : 'tablet';
    }
    if (w <= 900 && !hasMouse) {
      return landscape ? 'tablet-landscape' : 'tablet';
    }

    if (w >= 1600) return 'desktop';
    if (w >= 901) return landscape && h <= 880 ? 'laptop-landscape' : 'laptop';

    if (w <= 1024) return landscape ? 'tablet-landscape' : 'tablet';
    return 'laptop';
  }

  function apply() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var root = document.documentElement;
    var device = detectDevice(w, h);

    root.dataset.device = device;
    root.dataset.orientation = w > h ? 'landscape' : 'portrait';

    var vv = window.visualViewport;
    var browserBottom = 0;
    if (vv) {
      browserBottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    }
    root.style.setProperty('--browser-bottom', Math.round(browserBottom) + 'px');

    var offsets = {
      phone: 94,
      tablet: 98,
      'tablet-landscape': 90,
      laptop: 102,
      'laptop-landscape': 94,
      desktop: 112,
    };
    root.style.setProperty('--hud-bottom-offset', (offsets[device] || 96) + 'px');
  }

  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', function () {
    setTimeout(apply, 120);
  });
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', apply);
    visualViewport.addEventListener('scroll', apply);
  }
})();

animate(0);

})();
