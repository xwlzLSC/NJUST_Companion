module.exports = {
  apps: [
    {
      name: 'njust-companion',
      script: './server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        HOST: process.env.HOST || '127.0.0.1',
        PORT: process.env.PORT || '3030',
        PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || '',
        TRUST_PROXY: process.env.TRUST_PROXY || 'true',
        APP_STORAGE_DIR: process.env.APP_STORAGE_DIR || './storage',
        AUTO_SYNC_INTERVAL_MS: process.env.AUTO_SYNC_INTERVAL_MS || String(10 * 60 * 1000),
        KEEP_ALIVE_INTERVAL_MS: process.env.KEEP_ALIVE_INTERVAL_MS || String(8 * 60 * 1000)
      }
    }
  ]
};
