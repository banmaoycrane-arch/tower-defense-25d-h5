/**
 * 浏览器兼容 + 脚本加载
 * 3D 固定 2.5D 视角 — 本地 Three.js，UC/小米可用
 */
(function (global) {
  'use strict';

  if (!global.Object.assign) {
    global.Object.assign = function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        if (!src) continue;
        for (var k in src) {
          if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
        }
      }
      return target;
    };
  }

  if (!global.fetch) {
    global.fetch = function (url, opts) {
      opts = opts || {};
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(opts.method || 'GET', url, true);
        var headers = opts.headers || {};
        for (var k in headers) {
          if (Object.prototype.hasOwnProperty.call(headers, k)) xhr.setRequestHeader(k, headers[k]);
        }
        xhr.onload = function () {
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            json: function () { return Promise.resolve(JSON.parse(xhr.responseText || '{}')); },
            text: function () { return Promise.resolve(xhr.responseText); },
          });
        };
        xhr.onerror = function () { reject(new Error('network error')); };
        xhr.send(opts.body || null);
      });
    };
  }

  var THREE_SOURCES = [
    'js/vendor/three.min.js',
    'https://cdn.bootcdn.net/ajax/libs/three.js/r128/three.min.js',
  ];

  var GAME_SCRIPTS = [
    'js/leaderboard-config.js',
    'js/auth.js?v=3',
    'js/leaderboard.js',
    'js/difficulty.js',
    'js/audio.js',
    'js/maps.js',
    'js/build-spots.js?v=2',
    'js/render3d.js?v=8',
    'js/game.js?v=17',
  ];

  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = function () { cb(true); };
    s.onerror = function () { cb(false); };
    document.head.appendChild(s);
  }

  function showError(msg, detail) {
    var el = document.getElementById('compat-error');
    if (!el) return;
    var msgEl = document.getElementById('compat-error-msg');
    var detailEl = document.getElementById('compat-error-detail');
    if (msgEl) msgEl.textContent = msg || '页面加载失败';
    if (detailEl) detailEl.textContent = detail || '';
    el.classList.remove('hidden');
    var start = document.getElementById('start-screen');
    if (start) start.classList.add('hidden');
  }

  function loadThree(index, cb) {
    if (global.THREE) return cb(true);
    if (index >= THREE_SOURCES.length) return cb(false);
    loadScript(THREE_SOURCES[index], function (ok) {
      if (ok && global.THREE) cb(true);
      else loadThree(index + 1, cb);
    });
  }

  function loadGameScripts(index, cb) {
    if (index >= GAME_SCRIPTS.length) return cb(true);
    loadScript(GAME_SCRIPTS[index], function (ok) {
      if (!ok) return cb(false, GAME_SCRIPTS[index]);
      loadGameScripts(index + 1, cb);
    });
  }

  function checkWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) { return false; }
  }

  function boot() {
    global.onerror = function (msg, src, line) {
      showError('游戏脚本出错', (src || '') + (line ? (':' + line) : '') + ' ' + (msg || ''));
      return false;
    };

    loadThree(0, function (threeOk) {
      if (!threeOk || !global.THREE) {
        showError('3D 引擎加载失败', '请检查网络或换用 Chrome / Safari');
        return;
      }
      if (!checkWebGL()) {
        showError('浏览器不支持 3D 显示', '请在设置中开启硬件加速，或换用 Chrome / Safari');
        return;
      }
      loadGameScripts(0, function (ok, failed) {
        if (!ok) showError('游戏资源加载失败', failed || '');
      });
    });
  }

  global.Compat = { showError: showError, boot: boot };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
