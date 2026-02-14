const sql = require("mssql");

// Determine if we're in production (Render) or local
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.RENDER === "true" ||
  process.env.DB_SERVER !== "localhost";

const config = {
  user: process.env.DB_USER || "HROnboardingUser",
  password: process.env.DB_PASSWORD || "koyuki",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "HROnboardingDB",
  port: 1433, // SQL Server default port
  options: {
    // Enable encryption ONLY in production (Azure/Render)
    encrypt: isProduction ? true : false,

    // Trust server certificate for local development
    trustServerCertificate: !isProduction,

    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,

    // Additional options for better compatibility
    cryptoCredentialsDetails: {
      minVersion: "TLSv1.2",
    },
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
      console.log(
        `📡 Environment: ${isProduction ? "Production" : "Development"}`,
      );
      console.log(`🖥️  Server: ${config.server}`);
      console.log(`🗄️  Database: ${config.database}`);
      console.log(
        `🔒 Encryption: ${config.options.encrypt ? "Enabled" : "Disabled"}`,
      );
      console.log(
        `🔑 Trust Cert: ${config.options.trustServerCertificate ? "Yes" : "No"}`,
      );

      pool = await sql.connect(config);
      console.log("✅ MSSQL connection pool created");

      // Test the connection
      const result = await pool.request().query("SELECT 1 as test");
      console.log("✅ Database test query successful");

      // Get SQL Server version
      const version = await pool.request().query("SELECT @@VERSION as version");
      console.log(
        `📊 SQL Server: ${version.recordset[0].version.substring(0, 50)}...`,
      );
    } catch (err) {
      console.error("❌ Error creating connection pool:", err);
      console.error("Connection config:", {
        server: config.server,
        database: config.database,
        user: config.user,
        encrypt: config.options.encrypt,
        trustServerCertificate: config.options.trustServerCertificate,
      });

      // Provide helpful error messages
      if (err.code === "ESOCKET") {
        if (err.message.includes("self-signed certificate")) {
          console.error("\n🔧 FIX: Set encrypt: false for local development");
        }
        if (err.message.includes("ECONNREFUSED")) {
          console.error(
            "\n🔧 FIX: Make sure SQL Server is running on localhost:1433",
          );
        }
        if (err.message.includes("ENOTFOUND")) {
          console.error("\n🔧 FIX: Check your DB_SERVER environment variable");
        }
      }

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
      console.log("✅ Connection pool closed");
    } catch (err) {
      console.error("❌ Error closing pool:", err);
    }
  }
}

// Handle application shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT. Shutting down gracefully...");
  await closePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM. Shutting down gracefully...");
  await closePool();
  process.exit(0);
});

// Handle unhandled rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});

module.exports = {
  sql,
  getPool,
  closePool,
};
