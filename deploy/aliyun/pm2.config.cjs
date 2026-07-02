/** PM2 进程守护 — 在服务器 server 目录执行: pm2 start pm2.config.cjs */
module.exports = {
  apps: [{
    name: 'tower-defense',
    cwd: __dirname + '/../../server',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      PORT: 3000,
      NODE_ENV: 'production',
    },
  }],
};
