/**
 * PM2 Ecosystem Configuration — PRODUCTION ONLY
 *
 * Staging runs from a separate clone (~/governance-dashboard-v1-staging/).
 * See deploy/README_DEPLOY.md for the full deployment workflow.
 */
module.exports = {
  apps: [
    {
      name: "duckdb-api",
      script: "server/server.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

