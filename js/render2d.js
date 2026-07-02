/* global */
/**
 * 2D 俯视角渲染 — 手机友好，无需 WebGL
 */
(function (global) {
  'use strict';

  var canvas, ctx, theme, mapData;
  var view = { scale: 1, ox: 0, oy: 0, minS: 0.4, maxS: 3 };

  function hex(h) {
    return '#' + ('000000' + (h >>> 0).toString(16)).slice(-6);
  }

  function init(cvs) {
    canvas = cvs;
    ctx = canvas.getContext('2d');
    mapData = { paths: [], portals: [], bases: [], trees: [], buildSpots: {} };
    theme = {};
    resize();
  }

  function resize() {
    if (!canvas) return;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = global.innerWidth;
    var h = global.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fitMap(40, 40);
  }

  function fitMap(mapW, mapH) {
    var pad = 28;
    var cw = global.innerWidth;
    var ch = global.innerHeight;
    view.scale = Math.min((cw - pad * 2) / mapW, (ch - pad * 2) / mapH);
    view.scale = Math.max(view.minS, Math.min(view.maxS, view.scale));
    view.ox = cw / 2;
    view.oy = ch / 2;
  }

  function w2s(x, z) {
    return { x: view.ox + x * view.scale, y: view.oy + z * view.scale };
  }

  function s2w(sx, sy) {
    return { x: (sx - view.ox) / view.scale, z: (sy - view.oy) / view.scale };
  }

  function setTheme(t) {
    theme = t || {};
  }

  function clearMap() {
    mapData = { paths: [], portals: [], bases: [], trees: [], buildSpots: {} };
  }

  function addPathTile(x, z, color) {
    mapData.paths.push({ x: x, z: z, color: color });
  }

  function addPortal(x, z, color) {
    mapData.portals.push({ x: x, z: z, color: color, t: Math.random() * 6.28 });
  }

  function addBase(x, z, color) {
    mapData.bases.push({ x: x, z: z, color: color });
  }

  function addTree(x, z) {
    mapData.trees.push({ x: x, z: z });
  }

  function registerBuildSpot(key, x, z, y) {
    mapData.buildSpots[key] = { x: x, z: z, y: y || 0, occupied: false };
  }

  function setSpotOccupied(key, occupied) {
    if (mapData.buildSpots[key]) mapData.buildSpots[key].occupied = occupied;
  }

  var hover = { key: null, towerType: null, range: 0 };

  function setHover(key, towerType, range) {
    hover.key = key;
    hover.towerType = towerType;
    hover.range = range || 0;
  }

  function clearHover() {
    hover.key = null;
  }

  function drawBackground() {
    var cw = global.innerWidth;
    var ch = global.innerHeight;
    var g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, hex(theme.sky || 0x3a6898));
    g.addColorStop(0.55, hex(theme.ground || 0x3a7a48));
    g.addColorStop(1, hex(theme.fog || 0x2a5a38));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.globalAlpha = 0.12;
    var ts = Math.max(12, 18 * view.scale);
    for (var gx = -20; gx < cw + ts; gx += ts) {
      for (var gy = -20; gy < ch + ts; gy += ts) {
        ctx.fillStyle = ((Math.floor(gx / ts) + Math.floor(gy / ts)) % 2) ? '#ffffff' : '#000000';
        ctx.fillRect(gx, gy, ts, ts);
      }
    }
    ctx.restore();
  }

  function drawGroundPlate(mapSize) {
    var half = mapSize / 2;
    var tl = w2s(-half, -half);
    var br = w2s(half, half);
    ctx.fillStyle = hex(theme.ground || 0x3a7a48);
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x + 1, tl.y + 1, br.x - tl.x - 2, br.y - tl.y - 2);
  }

  function drawPaths() {
    var r = Math.max(6, 9 * view.scale);
    mapData.paths.forEach(function (p) {
      var s = w2s(p.x, p.z);
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = hex(p.color || theme.path || 0xc4a574);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  function drawTrees() {
    mapData.trees.forEach(function (t) {
      var s = w2s(t.x, t.z);
      var r = Math.max(8, 12 * view.scale);
      ctx.beginPath();
      ctx.arc(s.x, s.y - r * 0.3, r, 0, Math.PI * 2);
      ctx.fillStyle = hex(theme.tree || 0x2e7d32);
      ctx.fill();
      ctx.fillStyle = hex(theme.trunk || 0x5d4037);
      ctx.fillRect(s.x - 2, s.y, 4, r * 0.5);
    });
  }

  function drawBuildSpots() {
    Object.keys(mapData.buildSpots).forEach(function (key) {
      var sp = mapData.buildSpots[key];
      var s = w2s(sp.x, sp.z);
      var r = Math.max(10, 14 * view.scale);
      if (sp.occupied) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(80,80,80,0.35)';
        ctx.fill();
        return;
      }
      var hot = hover.key === key;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = hot ? 'rgba(76,175,80,0.55)' : 'rgba(76,175,80,0.28)';
      ctx.fill();
      ctx.strokeStyle = hot ? '#a5d6a7' : hex(theme.build || 0x4caf50);
      ctx.lineWidth = hot ? 2.5 : 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawPortals(time) {
    mapData.portals.forEach(function (p) {
      p.t += 0.02;
      var s = w2s(p.x, p.z);
      var r = Math.max(12, 16 * view.scale);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(p.t);
      ctx.strokeStyle = hex(p.color || theme.portal || 0xff1744);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 1.6);
      ctx.stroke();
      ctx.restore();
      ctx.font = Math.max(10, 12 * view.scale) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('入', s.x, s.y + 4);
    });
  }

  function drawBases() {
    mapData.bases.forEach(function (b) {
      var s = w2s(b.x, b.z);
      var r = Math.max(14, 18 * view.scale);
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = hex(b.color || theme.base || 0x1565c0);
      ctx.fill();
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = Math.max(14, 18 * view.scale) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏰', s.x, s.y + 6);
    });
  }

  function drawHoverRange() {
    if (!hover.key || !mapData.buildSpots[hover.key]) return;
    var sp = mapData.buildSpots[hover.key];
    var s = w2s(sp.x, sp.z);
    var rr = hover.range * view.scale;
    ctx.beginPath();
    ctx.arc(s.x, s.y, rr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100,180,255,0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,180,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawTower(tower, types) {
    var s = w2s(tower.x, tower.z);
    var cfg = types[tower.type] || {};
    var r = Math.max(11, 15 * view.scale);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = hex(cfg.color || 0x4caf50);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    var icon = tower.type === 'archer' ? '🏹' : tower.type === 'cannon' ? '💣' : '❄️';
    ctx.font = Math.max(12, 16 * view.scale) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(icon, s.x, s.y + 5);
    if (tower.rotation != null) {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.sin(tower.rotation) * r * 1.4, s.y + Math.cos(tower.rotation) * r * 1.4);
      ctx.stroke();
    }
  }

  function drawEnemy(enemy, types, time) {
    if (!enemy.alive) return;
    var cfg = types[enemy.type] || {};
    var s = w2s(enemy.x, enemy.z);
    var r = Math.max(8, (cfg.size || 0.5) * 14 * view.scale);
    var col = hex(cfg.color || 0xe53935);
    if (enemy.hitFlash > 0) col = '#ffffff';
    else if (enemy.slowTimer > 0) col = '#4fc3f7';

    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = Math.max(10, 12 * view.scale) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cfg.icon || '👾', s.x, s.y + 4);

    if (enemy.slowTimer > 0) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(79,195,247,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    var ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
    var bw = r * 2.2;
    var bh = Math.max(4, 5 * view.scale);
    var bx = s.x - bw / 2;
    var by = s.y - r - bh - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = enemy.slowTimer > 0 ? '#4fc3f7' : (ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#ff9800' : '#f44336');
    ctx.fillRect(bx, by, bw * ratio, bh);
  }

  function drawProjectile(p) {
    var s = w2s(p.x, p.z);
    var r = Math.max(3, 5 * view.scale);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = p.color || '#ffeb3b';
    ctx.fill();
  }

  function drawParticle(p) {
    var s = w2s(p.x, p.z);
    ctx.globalAlpha = Math.max(0, p.life / 0.6);
    ctx.fillStyle = p.color || '#fff';
    ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  function drawAreaEffect(fx) {
    var s = w2s(fx.x, fx.z);
    var t = 1 - Math.max(0, fx.life / fx.maxLife);
    var rr = fx.radius * view.scale * (0.2 + t);
    ctx.beginPath();
    ctx.arc(s.x, s.y, rr, 0, Math.PI * 2);
    ctx.strokeStyle = fx.type === 'cannon' ? 'rgba(255,87,34,' + (1 - t) + ')' : 'rgba(79,195,247,' + (1 - t) + ')';
    ctx.lineWidth = 3;
    ctx.stroke();
    if (fx.type === 'frost') {
      ctx.fillStyle = 'rgba(129,212,250,' + ((1 - t) * 0.25) + ')';
      ctx.fill();
    }
  }

  function render(state, types, enemyTypes, time) {
    if (!ctx) return;
    var mapSize = (state.gridSize || 20) * (state.tileSize || 2);
    drawBackground();
    drawGroundPlate(mapSize);
    drawPaths();
    drawTrees();
    drawBuildSpots();
    drawPortals(time || 0);
    drawBases();
    drawHoverRange();
    (state.towers || []).forEach(function (t) { drawTower(t, types); });
    (state.enemies || []).forEach(function (e) { drawEnemy(e, enemyTypes, time); });
    (state.projectiles || []).forEach(function (p) { if (p.alive) drawProjectile(p); });
    (state.particles || []).forEach(function (p) { drawParticle(p); });
    (state.areaEffects || []).forEach(function (fx) { drawAreaEffect(fx); });
  }

  global.Render2D = {
    init: init,
    resize: resize,
    fitMap: fitMap,
    w2s: w2s,
    s2w: s2w,
    setTheme: setTheme,
    clearMap: clearMap,
    addPathTile: addPathTile,
    addPortal: addPortal,
    addBase: addBase,
    addTree: addTree,
    registerBuildSpot: registerBuildSpot,
    setSpotOccupied: setSpotOccupied,
    setHover: setHover,
    clearHover: clearHover,
    render: render,
    getBuildSpots: function () { return mapData.buildSpots; },
  };
})(window);
