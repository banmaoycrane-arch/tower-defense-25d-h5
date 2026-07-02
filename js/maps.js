/* global */
(function () {
'use strict';

/** 地图网格边长（20×20 单元格，坐标 0～19） */
window.MAP_GRID_SIZE = 20;

/**
 * 关卡数据格式
 * routes: [{ id, points:[[gx,gz,h],...], portalColor? }]
 * bases: [[gx,gz,h], ...] 基地出口（须在对应路线终点）
 * buildSpots: [[gx,gz,h], ...] 建塔位（含高度）
 * waves.enemies: { type, count, route? }
 */
window.LEVEL_CONFIGS = [
  {
    id: 1, name: '绿野初阵', desc: '单路蜿蜒穿越大地图，熟悉操作', bgm: 'meadow',
    theme: { ground: 0x1a3a2a, path: 0x8d6e63, sky: 0x0a1628, fog: 0x0a1628, build: 0x2e7d32, tree: 0x2e7d32, trunk: 0x5d4037, base: 0x1565c0, portal: 0xff1744 },
    routes: [{
      id: 'main',
      points: [[0,10,0],[3,10,0],[3,5,0],[8,5,0],[8,12,0],[13,12,0],[13,6,0],[17,6,0],[17,14,0],[14,14,0],[14,17,0],[10,17,0],[10,19,0]],
    }],
    bases: [[10,19,0]],
    buildSpots: [
      [1,9,0],[1,11,0],[2,4,0],[5,4,0],[5,7,0],[7,11,0],[9,11,0],[9,13,0],[12,11,0],[12,13,0],
      [14,5,0],[16,5,0],[16,8,0],[18,13,0],[18,15,0],[15,15,0],[12,18,0],[7,18,0],[5,16,0],[6,8,0],[11,4,0],[15,10,0],
    ],
    trees: [[0,0],[19,0],[0,19],[19,19],[2,15,0],[16,18,0]],
    startGold: 220, lives: 20,
    clearReward: { gold: 90, title: '初阵告捷', desc: '获得 90 金币！' },
    waves: [
      { enemies: [{ type: 'basic', count: 8, route: 'main' }], interval: 1.1 },
      { enemies: [{ type: 'basic', count: 10, route: 'main' }], interval: 0.95 },
      { enemies: [{ type: 'basic', count: 8, route: 'main' }, { type: 'fast', count: 4, route: 'main' }], interval: 0.85 },
    ],
  },
  {
    id: 2, name: '双路峡谷', desc: '东西两路长途奔袭，汇入同一基地', bgm: 'desert',
    theme: { ground: 0x4a3728, path: 0xc4a574, sky: 0x1a1208, fog: 0x1a1208, build: 0x6d4c2a, tree: 0x8d6e3a, trunk: 0x4e342e, base: 0xff8f00, portal: 0xff5722 },
    routes: [
      { id: 'west', portalColor: 0xff5722, points: [[0,8,0],[4,8,0],[4,4,0],[8,4,0],[8,11,0],[11,11,0],[11,15,0],[11,18,0],[11,19,0]] },
      { id: 'east', portalColor: 0xff9800, points: [[19,6,0],[15,6,0],[15,10,0],[12,10,0],[12,13,0],[11,13,0],[11,15,0],[11,18,0],[11,19,0]] },
    ],
    bases: [[11,19,0]],
    buildSpots: [
      [1,7,0],[1,9,0],[3,3,0],[6,3,0],[6,6,0],[9,10,0],[9,12,0],[10,14,0],[13,10,0],[14,5,0],
      [16,5,0],[16,8,0],[17,11,0],[14,14,0],[8,14,0],[6,16,0],[4,18,0],[8,18,0],[13,17,0],[17,4,0],[18,8,0],[5,12,0],
    ],
    trees: [[19,19],[0,0],[18,18],[2,2]],
    startGold: 200, lives: 18,
    clearReward: { gold: 110, title: '峡谷通行', desc: '获得 110 金币！' },
    waves: [
      { enemies: [{ type: 'basic', count: 5, route: 'west' }, { type: 'basic', count: 5, route: 'east' }], interval: 1.0 },
      { enemies: [{ type: 'fast', count: 7, route: 'west' }, { type: 'fast', count: 7, route: 'east' }], interval: 0.85 },
      { enemies: [{ type: 'basic', count: 6, route: 'west' }, { type: 'tank', count: 3, route: 'east' }], interval: 0.78 },
    ],
  },
  {
    id: 3, name: '雪域高架', desc: '超长路线含多层高度差', bgm: 'frost',
    theme: { ground: 0x2a3a4a, path: 0xb0bec5, sky: 0x0d1b2a, fog: 0x0d1b2a, build: 0x37474f, tree: 0x78909c, trunk: 0x455a64, base: 0x0288d1, portal: 0xe91e63 },
    routes: [{
      id: 'main',
      points: [[10,0,0],[10,3,0],[6,3,0],[6,8,1.2],[10,8,1.2],[10,6,1.2],[14,6,0.8],[14,11,0],[18,11,0],[15,11,0],[15,15,0],[11,15,0],[11,18,0],[10,18,0],[10,19,0]],
    }],
    bases: [[10,19,0]],
    buildSpots: [
      [8,1,0],[12,1,0],[4,2,0],[4,6,1.2],[8,7,1.2],[12,7,1.2],[12,5,1.2],[16,5,0.8],[16,9,0.8],[17,12,0],
      [13,13,0],[9,13,0],[8,16,0],[6,18,0],[13,17,0],[14,18,0],[7,10,0],[5,11,0],[18,8,0],[2,4,0],
    ],
    trees: [[0,2],[19,2],[0,17],[19,17]],
    startGold: 190, lives: 18,
    clearReward: { gold: 130, title: '冰川突破', desc: '获得 130 金币！' },
    waves: [
      { enemies: [{ type: 'basic', count: 12, route: 'main' }], interval: 0.9 },
      { enemies: [{ type: 'fast', count: 10, route: 'main' }, { type: 'tank', count: 3, route: 'main' }], interval: 0.78 },
      { enemies: [{ type: 'basic', count: 8, route: 'main' }, { type: 'fast', count: 8, route: 'main' }, { type: 'tank', count: 4, route: 'main' }], interval: 0.72 },
    ],
  },
  {
    id: 4, name: '熔岩岔口', desc: '双入口长途汇合，一路经高台', bgm: 'battle',
    theme: { ground: 0x3a1a1a, path: 0x5d4037, sky: 0x1a0808, fog: 0x1a0808, build: 0xbf360c, tree: 0x4a148c, trunk: 0x212121, base: 0xff6f00, portal: 0xff1744 },
    routes: [
      { id: 'north', portalColor: 0xff1744, points: [[0,5,0],[5,5,0],[5,9,1.0],[9,9,1.0],[9,14,0],[11,14,0],[11,17,0],[11,19,0]] },
      { id: 'south', portalColor: 0xff6f00, points: [[19,12,0],[14,12,0],[14,16,0],[11,16,0],[11,17,0],[11,19,0]] },
    ],
    bases: [[11,19,0]],
    buildSpots: [
      [1,4,0],[2,6,0],[4,8,1.0],[7,8,1.0],[7,11,0],[8,15,0],[10,12,0],[13,11,0],[13,15,0],[15,11,0],
      [16,14,0],[17,10,0],[18,14,0],[6,12,0],[4,14,0],[2,10,0],[8,4,0],[12,6,0],[14,4,0],[16,6,0],[9,17,0],
    ],
    trees: [[0,0],[19,0],[19,19],[3,17,0]],
    startGold: 180, lives: 17,
    clearReward: { gold: 150, title: '熔岩征服', desc: '获得 150 金币！' },
    waves: [
      { enemies: [{ type: 'tank', count: 3, route: 'north' }, { type: 'basic', count: 8, route: 'south' }], interval: 0.88 },
      { enemies: [{ type: 'fast', count: 10, route: 'north' }, { type: 'tank', count: 4, route: 'south' }], interval: 0.72 },
      { enemies: [{ type: 'basic', count: 10, route: 'north' }, { type: 'fast', count: 8, route: 'south' }, { type: 'tank', count: 5, route: 'north' }], interval: 0.68 },
    ],
  },
  {
    id: 5, name: '幽林三径', desc: '三条长路径汇聚，需分兵把守', bgm: 'forest',
    theme: { ground: 0x1a2e1a, path: 0x5d4037, sky: 0x051005, fog: 0x051005, build: 0x33691e, tree: 0x1b5e20, trunk: 0x3e2723, base: 0x43a047, portal: 0x76ff03 },
    routes: [
      { id: 'left', portalColor: 0x76ff03, points: [[0,8,0],[3,8,0],[3,4,0],[7,4,0.8],[7,8,0.8],[11,8,0.8],[11,13,0],[11,16,0],[11,18,0],[11,19,0]] },
      { id: 'top', portalColor: 0x00e676, points: [[10,0,0],[10,3,0],[14,3,0],[14,7,0.5],[11,7,0.5],[11,11,0],[11,13,0],[11,16,0],[11,18,0],[11,19,0]] },
      { id: 'right', portalColor: 0x69f0ae, points: [[19,15,0],[15,15,0],[13,15,0],[11,15,0],[11,16,0],[11,18,0],[11,19,0]] },
    ],
    bases: [[11,19,0]],
    buildSpots: [
      [1,7,0],[2,3,0.8],[5,3,0.8],[5,6,0.8],[9,6,0.8],[9,9,0.8],[8,12,0],[8,14,0],[13,12,0],[13,14,0],
      [15,2,0],[16,6,0.5],[17,10,0],[17,14,0],[14,16,0],[8,17,0],[6,17,0],[4,12,0],[2,10,0],[16,18,0],[7,11,0],[12,4,0],[18,12,0],
    ],
    trees: [[0,0],[19,0],[0,19],[8,0],[18,19]],
    startGold: 170, lives: 16,
    clearReward: { gold: 170, title: '森林净化', desc: '获得 170 金币！' },
    waves: [
      { enemies: [{ type: 'fast', count: 5, route: 'left' }, { type: 'fast', count: 5, route: 'top' }, { type: 'fast', count: 5, route: 'right' }], interval: 0.78 },
      { enemies: [{ type: 'basic', count: 7, route: 'left' }, { type: 'tank', count: 3, route: 'top' }, { type: 'fast', count: 7, route: 'right' }], interval: 0.68 },
      { enemies: [{ type: 'basic', count: 8, route: 'left' }, { type: 'fast', count: 8, route: 'top' }, { type: 'tank', count: 5, route: 'right' }], interval: 0.62 },
    ],
  },
  {
    id: 6, name: '水晶双门', desc: '两线独立作战，各守各的基地', bgm: 'battle',
    theme: { ground: 0x2a1a3a, path: 0x7e57c2, sky: 0x12082a, fog: 0x12082a, build: 0x512da8, tree: 0x7c4dff, trunk: 0x4527a0, base: 0x00bcd4, portal: 0xe040fb },
    routes: [
      { id: 'alpha', portalColor: 0xe040fb, points: [[0,3,0],[4,3,0],[4,7,1.0],[2,7,1.0],[2,12,0],[6,12,0],[6,16,0],[4,16,0],[4,18,0],[4,19,0]] },
      { id: 'beta', portalColor: 0x7c4dff, points: [[19,16,0],[15,16,0],[15,12,0],[17,12,0],[17,6,0],[14,6,0],[14,2,0],[17,2,0],[17,0,0]] },
    ],
    bases: [[4,19,0],[17,0,0]],
    buildSpots: [
      [1,2,0],[2,5,1.0],[1,9,1.0],[3,14,0],[5,15,0],[7,17,0],[8,11,0],[10,14,0],[12,16,0],[16,14,0],
      [16,10,0],[18,8,0],[18,4,0],[15,3,0],[12,1,0],[9,3,0],[6,5,0],[8,8,0],[11,11,0],[13,8,0],[3,18,0],[16,18,0],
    ],
    trees: [[8,0],[10,19],[0,19],[19,19]],
    startGold: 160, lives: 16,
    clearReward: { gold: 190, title: '矿洞占领', desc: '获得 190 金币！' },
    waves: [
      { enemies: [{ type: 'basic', count: 9, route: 'alpha' }, { type: 'basic', count: 8, route: 'beta' }], interval: 0.72 },
      { enemies: [{ type: 'tank', count: 5, route: 'alpha' }, { type: 'fast', count: 10, route: 'beta' }], interval: 0.62 },
      { enemies: [{ type: 'basic', count: 10, route: 'alpha' }, { type: 'fast', count: 10, route: 'beta' }, { type: 'tank', count: 5, route: 'alpha' }], interval: 0.58 },
    ],
  },
  {
    id: 7, name: '遗迹迷城', desc: '高低错落双线，各通独立基地', bgm: 'frost',
    theme: { ground: 0x3a3a3a, path: 0x9e9e9e, sky: 0x121212, fog: 0x121212, build: 0x616161, tree: 0x757575, trunk: 0x424242, base: 0xffc107, portal: 0xf44336 },
    routes: [
      { id: 'low', portalColor: 0xf44336, points: [[0,16,0],[4,16,0],[4,12,0],[0,12,0],[0,7,0],[5,7,0],[5,4,0],[5,2,0]] },
      { id: 'high', portalColor: 0xff9800, points: [[8,0,0],[8,4,1.5],[5,4,1.5],[5,8,1.5],[9,8,1.5],[13,8,0.8],[13,4,0.8],[16,4,0],[17,4,0],[18,4,0]] },
    ],
    bases: [[5,2,0],[18,4,0]],
    buildSpots: [
      [1,15,0],[2,11,0],[2,6,0],[3,3,0],[7,1,0],[6,6,1.5],[4,7,1.5],[7,9,1.5],[10,7,1.5],[11,5,1.5],
      [12,3,0.8],[14,2,0.8],[15,6,0.8],[17,6,0],[16,8,0],[10,11,0],[8,14,0],[12,14,0],[14,16,0],[18,8,0],[1,18,0],[16,18,0],
    ],
    trees: [[0,0],[19,19],[19,0]],
    startGold: 150, lives: 15,
    clearReward: { gold: 210, title: '废墟重建', desc: '获得 210 金币！' },
    waves: [
      { enemies: [{ type: 'basic', count: 10, route: 'low' }, { type: 'fast', count: 8, route: 'high' }], interval: 0.68 },
      { enemies: [{ type: 'fast', count: 12, route: 'low' }, { type: 'tank', count: 5, route: 'high' }], interval: 0.58 },
      { enemies: [{ type: 'basic', count: 10, route: 'low' }, { type: 'fast', count: 10, route: 'high' }, { type: 'tank', count: 6, route: 'low' }], interval: 0.52 },
    ],
  },
  {
    id: 8, name: '亡灵三线', desc: '三入口长途围攻同一基地', bgm: 'battle',
    theme: { ground: 0x1a1a2e, path: 0x4a4a6a, sky: 0x0a0a14, fog: 0x0a0a14, build: 0x3949ab, tree: 0x283593, trunk: 0x1a237e, base: 0x7e57c2, portal: 0x00e676 },
    routes: [
      { id: 'a', portalColor: 0x00e676, points: [[0,17,0],[4,17,0],[4,13,0],[7,13,0],[7,17,0],[10,17,0],[10,18,0],[10,19,0]] },
      { id: 'b', portalColor: 0x69f0ae, points: [[19,8,0],[15,8,0],[15,12,0],[12,12,0],[10,12,0],[10,15,0],[10,17,0],[10,18,0],[10,19,0]] },
      { id: 'c', portalColor: 0x1de9b6, points: [[0,6,0],[5,6,0],[5,2,1.2],[10,2,1.2],[10,8,0],[10,12,0],[10,15,0],[10,17,0],[10,18,0],[10,19,0]] },
    ],
    bases: [[10,19,0]],
    buildSpots: [
      [1,16,0],[2,12,0],[2,5,0],[4,3,1.2],[7,3,1.2],[8,6,0],[8,10,0],[8,14,0],[12,11,0],[12,14,0],
      [14,7,0],[16,10,0],[17,14,0],[14,16,0],[6,15,0],[4,18,0],[12,17,0],[16,5,0],[18,12,0],[11,4,0],[6,8,0],[13,18,0],[17,17,0],
    ],
    trees: [[19,0],[0,0],[19,19]],
    startGold: 140, lives: 15,
    clearReward: { gold: 230, title: '亡灵驱散', desc: '获得 230 金币！' },
    waves: [
      { enemies: [{ type: 'basic', count: 7, route: 'a' }, { type: 'fast', count: 7, route: 'b' }, { type: 'basic', count: 7, route: 'c' }], interval: 0.62 },
      { enemies: [{ type: 'tank', count: 5, route: 'a' }, { type: 'fast', count: 10, route: 'b' }, { type: 'tank', count: 5, route: 'c' }], interval: 0.52 },
      { enemies: [{ type: 'basic', count: 10, route: 'a' }, { type: 'fast', count: 12, route: 'b' }, { type: 'tank', count: 7, route: 'c' }], interval: 0.48 },
    ],
  },
  {
    id: 9, name: '天空浮岛', desc: '多层浮岛，三路分守双基地', bgm: 'forest',
    theme: { ground: 0x1a3a5a, path: 0x81d4fa, sky: 0x0a2040, fog: 0x0a2040, build: 0x0277bd, tree: 0x4fc3f7, trunk: 0x01579b, base: 0x00e5ff, portal: 0xff4081 },
    routes: [
      { id: 'r1', portalColor: 0xff4081, points: [[0,2,0],[0,6,0.8],[4,6,0.8],[4,10,1.5],[2,10,1.5],[2,16,0],[2,18,0]] },
      { id: 'r2', portalColor: 0xf50057, points: [[19,9,0],[15,9,0],[15,12,0.6],[11,12,0.6],[11,16,0],[8,16,0],[8,18,0]] },
      { id: 'r3', portalColor: 0xff80ab, points: [[10,0,1.2],[14,0,1.2],[14,4,1.2],[10,4,1.2],[10,8,0.6],[11,12,0.6],[11,16,0],[8,16,0],[8,18,0]] },
    ],
    bases: [[2,18,0],[8,18,0]],
    buildSpots: [
      [1,1,0],[2,5,0.8],[3,8,1.5],[5,5,0.6],[6,2,1.2],[8,3,1.2],[10,6,0.6],[12,3,1.2],[14,6,0],[16,8,0],
      [17,11,0],[14,14,0],[12,17,0],[6,17,0],[4,14,0],[7,10,0.6],[9,14,0],[16,14,0],[18,6,0],[5,18,0],[13,18,0],[11,8,0],[17,16,0],
    ],
    trees: [[18,0],[0,19],[19,19]],
    startGold: 130, lives: 14,
    clearReward: { gold: 260, title: '浮岛掌控', desc: '获得 260 金币！' },
    waves: [
      { enemies: [{ type: 'basic', count: 7, route: 'r1' }, { type: 'fast', count: 7, route: 'r2' }, { type: 'basic', count: 7, route: 'r3' }], interval: 0.58 },
      { enemies: [{ type: 'tank', count: 6, route: 'r1' }, { type: 'fast', count: 10, route: 'r2' }, { type: 'tank', count: 6, route: 'r3' }], interval: 0.48 },
      { enemies: [{ type: 'basic', count: 12, route: 'r1' }, { type: 'fast', count: 12, route: 'r2' }, { type: 'tank', count: 8, route: 'r3' }], interval: 0.42 },
    ],
  },
  {
    id: 10, name: '魔王城堡', desc: '三入口双基地，终极 labyrinth', bgm: 'boss',
    theme: { ground: 0x2a0a0a, path: 0x4a2020, sky: 0x100505, fog: 0x100505, build: 0x880e4f, tree: 0xb71c1c, trunk: 0x212121, base: 0xffd600, portal: 0xd50000 },
    routes: [
      { id: 'gate1', portalColor: 0xd50000, points: [[0,9,0],[3,9,0],[3,5,0.8],[7,5,0.8],[7,2,1.5],[12,2,1.5],[12,6,0.8],[14,6,0.8],[14,10,0],[10,10,0],[10,14,0],[6,14,0],[6,17,0],[3,17,0],[3,19,0]] },
      { id: 'gate2', portalColor: 0xff1744, points: [[19,9,0],[16,9,0],[16,13,0],[12,13,0],[10,13,0],[6,14,0],[6,17,0],[3,17,0],[3,19,0]] },
      { id: 'gate3', portalColor: 0xff5252, points: [[10,19,0],[10,16,0],[14,16,0],[14,12,0],[17,12,0],[17,6,0],[17,3,0],[17,0,0]] },
    ],
    bases: [[3,19,0],[17,0,0]],
    buildSpots: [
      [1,8,0],[2,4,0.8],[4,2,1.5],[6,1,1.5],[9,1,1.5],[11,4,0.8],[13,4,0.8],[15,5,0],[16,8,0],[16,11,0],
      [13,14,0],[11,11,0],[8,11,0],[8,14,0],[5,12,0],[4,15,0],[1,17,0],[8,17,0],[12,17,0],[15,15,0],[18,10,0],[18,4,0],[7,7,0],[14,8,0],[5,6,0],[11,18,0],
    ],
    trees: [[19,19],[0,0],[19,0],[8,8],[12,18]],
    startGold: 120, lives: 12,
    clearReward: { gold: 550, title: '王国守护者', desc: '终极 550 金币！' },
    waves: [
      { enemies: [{ type: 'basic', count: 10, route: 'gate1' }, { type: 'fast', count: 10, route: 'gate2' }, { type: 'tank', count: 5, route: 'gate3' }], interval: 0.52 },
      { enemies: [{ type: 'fast', count: 14, route: 'gate1' }, { type: 'tank', count: 7, route: 'gate2' }, { type: 'fast', count: 14, route: 'gate3' }], interval: 0.42 },
      { enemies: [{ type: 'basic', count: 12, route: 'gate1' }, { type: 'fast', count: 12, route: 'gate2' }, { type: 'tank', count: 10, route: 'gate3' }], interval: 0.38 },
      { enemies: [{ type: 'basic', count: 14, route: 'gate1' }, { type: 'fast', count: 14, route: 'gate2' }, { type: 'tank', count: 12, route: 'gate3' }], interval: 0.32 },
    ],
  },
];

window.CREDITS = [
  '🎮 游戏设计 & 开发 — Cursor AI + 您',
  '🎨 3D 渲染引擎 — Three.js',
  '🎵 背景音乐 — 6 种风格自动切换',
  '🏰 特别感谢 — 每一位坚守阵地的玩家',
  '📱 微信小游戏版 — 多端运行',
  '❤️ 感谢您的游玩！',
];

})();
