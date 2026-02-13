require("dotenv").config();
const sql = require("mssql");

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  options: {
    trustServerCertificate: true,
    encrypt: String(process.env.DB_ENCRYPT || "false").toLowerCase() === "true",
    enableArithAbort: true,
  },
};

let poolPromise;
async function getPool() {
  if (!poolPromise) poolPromise = sql.connect(sqlConfig);
  return poolPromise;
}

module.exports = { sql, sqlConfig, getPool };
