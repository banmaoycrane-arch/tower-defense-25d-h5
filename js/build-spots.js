/* global */
/**
 * 沿路线两侧生成建塔位（紧贴道路，仅 1 格）
 */
(function (global) {
  'use strict';

  function cellKey(gx, gz) { return gx + ',' + gz; }

  function seededRand(seed) {
    var s = seed >>> 0;
    return function () {
      s = (((s * 1664525) >>> 0) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function parsePt(p) {
    return { gx: p[0], gz: p[1], h: p[2] || 0 };
  }

  function collectPathCells(routes, gridSize) {
    var map = {};
    (routes || []).forEach(function (route) {
      var pts = route.points || [];
      for (var i = 0; i < pts.length - 1; i++) {
        var a = parsePt(pts[i]);
        var b = parsePt(pts[i + 1]);
        var dx = b.gx - a.gx;
        var dz = b.gz - a.gz;
        var steps = Math.max(Math.abs(dx), Math.abs(dz), 1);
        for (var s = 0; s <= steps; s++) {
          var t = steps === 0 ? 0 : s / steps;
          var gx = Math.round(a.gx + dx * t);
          var gz = Math.round(a.gz + dz * t);
          var h = a.h + (b.h - a.h) * t;
          if (gx < 0 || gz < 0 || gx >= gridSize || gz >= gridSize) continue;
          var key = cellKey(gx, gz);
          if (!map[key]) {
            map[key] = { gx: gx, gz: gz, h: h, dx: dx, dz: dz };
          }
        }
      }
    });
    return map;
  }

  function perpendicularSides(dx, dz) {
    if (dx === 0 && dz === 0) return [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var nx = -dz;
    var nz = dx;
    if (nx === 0 && nz === 0) return [[1, 0], [-1, 0]];
    var ax = nx === 0 ? 0 : (nx > 0 ? 1 : -1);
    var az = nz === 0 ? 0 : (nz > 0 ? 1 : -1);
    return [[ax, az], [-ax, -az]];
  }

  function isBlocked(gx, gz, pathMap, bases, portals, gridSize) {
    if (gx < 0 || gz < 0 || gx >= gridSize || gz >= gridSize) return true;
    if (pathMap[cellKey(gx, gz)]) return true;
    var i;
    for (i = 0; i < bases.length; i++) {
      var b = parsePt(bases[i]);
      if (Math.abs(b.gx - gx) + Math.abs(b.gz - gz) <= 1) return true;
    }
    for (i = 0; i < portals.length; i++) {
      var p = parsePt(portals[i]);
      if (Math.abs(p.gx - gx) + Math.abs(p.gz - gz) <= 1) return true;
    }
    return false;
  }

  function generate(level, gridSize, opts) {
    opts = opts || {};
    var seed = opts.seed != null ? opts.seed : (level.id || 1) * 7919;
    var minCount = opts.minCount || 36;
    var maxCount = opts.maxCount || 48;
    var pathDist = opts.pathDist != null ? opts.pathDist : 1;
    var rand = seededRand(seed);

    var pathMap = collectPathCells(level.routes, gridSize);
    var bases = level.bases || [];
    var portals = [];
    (level.routes || []).forEach(function (r) {
      if (r.points && r.points[0]) portals.push(r.points[0]);
    });

    var candidateMap = {};
    var ordered = [];

    Object.keys(pathMap).forEach(function (k) {
      var cell = pathMap[k];
      var sides = perpendicularSides(cell.dx, cell.dz);
      sides.forEach(function (off, sideIdx) {
        var gx = cell.gx + off[0] * pathDist;
        var gz = cell.gz + off[1] * pathDist;
        if (isBlocked(gx, gz, pathMap, bases, portals, gridSize)) return;
        var ck = cellKey(gx, gz);
        if (candidateMap[ck]) return;
        var h = cell.h;
        candidateMap[ck] = {
          gx: gx, gz: gz, h: h, side: sideIdx,
          weight: 0.85 + rand() * 0.15,
        };
        ordered.push(candidateMap[ck]);
      });
    });

    if (!ordered.length) {
      return (level.buildSpots || []).slice();
    }

    ordered.sort(function (a, b) { return b.weight - a.weight; });

    var target = Math.min(ordered.length, minCount + Math.floor(rand() * (maxCount - minCount + 1)));

    var picked = [];
    var pickedSet = {};

    ordered.forEach(function (c) {
      if (picked.length >= target) return;
      picked.push([c.gx, c.gz, c.h]);
      pickedSet[cellKey(c.gx, c.gz)] = true;
    });

    if (picked.length < minCount) {
      ordered.forEach(function (c) {
        if (picked.length >= minCount) return;
        var ck = cellKey(c.gx, c.gz);
        if (!pickedSet[ck]) {
          picked.push([c.gx, c.gz, c.h]);
          pickedSet[ck] = true;
        }
      });
    }

    return picked;
  }

  global.BuildSpots = { generate: generate, collectPathCells: collectPathCells };
})(window);
