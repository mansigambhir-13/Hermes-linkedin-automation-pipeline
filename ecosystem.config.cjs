// pm2 process manager config for a VM / always-on Mac deploy:
//   npm i -g pm2 && pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
// Keeps the bot + worker alive across crashes and reboots. Env comes from the repo-root .env.
module.exports = {
  apps: [
    {
      name: 'rss-bot',
      script: 'pnpm',
      args: 'start:bot',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 50,
      restart_delay: 3000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'rss-worker',
      script: 'pnpm',
      args: 'start:worker',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 50,
      restart_delay: 3000,
      env: { NODE_ENV: 'production' },
    },
  ],
};
