/**
 * PM2 Ecosystem Configuration — PRODUCTION ONLY
 *
 * This configures the production API server (port 3001).
 * Staging runs from a separate clone — see ecosystem.staging.config.cjs
 * in ~/governance-dashboard-v1-staging/server/.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 logs duckdb-api
 *   pm2 restart duckdb-api
 *   pm2 stop duckdb-api
 *
 * Auto-start on boot:
 *   pm2 startup
 *   pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'duckdb-api',
      script: 'server.js',
      cwd: __dirname,
      node_args: '--max-old-space-size=2048',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 1000,
      max_memory_restart: '1536M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
