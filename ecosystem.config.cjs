module.exports = {
  apps: [
    {
      name: "duckdb-api",
      script: "server/server.js",   // ✅ FIXED
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

