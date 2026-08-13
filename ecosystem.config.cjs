module.exports = {
  apps: [
    {
      name: 'njust-companion',
      script: './rust-server/target/release/njust-companion-server',
      interpreter: 'none',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        HOST: process.env.HOST || '127.0.0.1',
        PORT: process.env.PORT || '3030',
        APP_STORAGE_DIR: process.env.APP_STORAGE_DIR || './storage'
      }
    }
  ]
};
