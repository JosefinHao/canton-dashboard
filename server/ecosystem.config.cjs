/**
 * PM2 Ecosystem Configuration
 * 
 * This configures the READ-ONLY API server.
 * Ingestion runs separately via scripts/ingest/ (manual, cron, or CI).
 * 
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 logs duckdb-api
 *   pm2 monit
 *   pm2 restart duckdb-api
 *   pm2 stop duckdb-api
 *   pm2 delete duckdb-api
 * 
 * Auto-start on boot:
 *   pm2 startup
 *   pm2 save
 */

const SHARED_APP_CONFIG = {
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
};

module.exports = {
  apps: [
    {
      ...SHARED_APP_CONFIG,
      name: 'duckdb-api',
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
    {
      ...SHARED_APP_CONFIG,
      name: 'duckdb-api-staging',
      error_file: './logs/pm2-staging-error.log',
      out_file: './logs/pm2-staging-out.log',
      env: {
        NODE_ENV: 'staging',
        PORT: 3002,
      },
    },
  ],
};
