/**
 * 云端排行榜配置 — H5 与微信版请保持 apiBase 一致
 *
 * 阿里云部署示例：
 *   apiBase: 'https://game.您的域名.com',
 *
 * 同服务器部署 H5 时可留空（自动用当前网址）
 * 微信版必须填写完整 https 地址
 */
(function () {
  window.LEADERBOARD_CONFIG = {
    apiBase: '',
    maxDisplay: 10,
    maxStored: 50,
  };
})();
