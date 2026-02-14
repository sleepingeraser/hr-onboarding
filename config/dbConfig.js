const sql = require("mssql");

const config = {
  user: process.env.DB_USER || "HROnboardingUser",
  password: process.env.DB_PASSWORD || "koyuki",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "HROnboardingDB",
  options: {
    encrypt: false, // CHANGE THIS TO false FOR LOCAL
    trustServerCertificate: true, // ADD THIS
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },
};

let pool = null;

async function getPool() {
  if (!pool) {
    try {
      console.log("🔄 Connecting to SQL Server...");
      console.log(`Server: ${config.server}, Database: ${config.database}`);
      console.log(
        `Encryption: ${config.options.encrypt ? "Enabled" : "Disabled"}`,
      );

      pool = await sql.connect(config);
      console.log("✅ MSSQL connection pool created");

      // Test the connection
      const result = await pool.request().query("SELECT 1 as test");
      console.log("✅ Database test query successful");
    } catch (err) {
      console.error("❌ Error creating connection pool:", err);
      console.error("Connection config:", {
        server: config.server,
        database: config.database,
        user: config.user,
        encrypt: config.options.encrypt,
      });
      throw err;
    }
  }
  return pool;
}

// Add disconnect function for cleanup
async function closePool() {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      console.log("Connection pool closed");
    } catch (err) {
      console.error("Error closing pool:", err);
    }
  }
}

// Handle application shutdown
process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closePool();
  process.exit(0);
});

module.exports = {
  sql,
  getPool,
  closePool,
};
