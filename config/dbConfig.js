const sql = require("mssql");

const config = {
  user: process.env.DB_USER || "HROnboardingUser",
  password: process.env.DB_PASSWORD || "koyuki",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "HROnboardingDB",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(config);
      console.log("MSSQL connection pool created");
    } catch (err) {
      console.error("Error creating connection pool:", err);
      throw err;
    }
  }
  return pool;
}

module.exports = {
  sql,
  getPool,
};
