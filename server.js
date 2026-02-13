const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const sql = require("mssql");

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// MSSQL config (set these in .env)
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

app.use(cors());
app.use(express.json());

// serve frontend
app.use(express.static(path.join(__dirname, "public")));

// serve uploads
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// health
app.get("/api/ping", (req, res) => res.json({ ok: true }));

function signToken(user) {
  // keep payload small + useful
  return jwt.sign(
    {
      userId: user.UserId,
      name: user.Name,
      email: user.Email,
      role: user.Role,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// auth routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "name, email, password, role are required" });
    }
    if (!["HR", "EMPLOYEE"].includes(role)) {
      return res.status(400).json({ message: "role must be HR or EMPLOYEE" });
    }
    if (String(password).length < 6) {
      return res
        .status(400)
        .json({ message: "password must be at least 6 characters" });
    }

    const pool = await getPool();

    // check existing
    const existing = await pool
      .request()
      .input("Email", sql.NVarChar(200), email)
      .query("SELECT TOP 1 UserId FROM Users WHERE Email=@Email");

    if (existing.recordset.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // insert + return new row
    const inserted = await pool
      .request()
      .input("Name", sql.NVarChar(120), name)
      .input("Email", sql.NVarChar(200), email)
      .input("PasswordHash", sql.NVarChar(200), passwordHash)
      .input("Role", sql.NVarChar(20), role).query(`
        INSERT INTO Users (Name, Email, PasswordHash, Role)
        OUTPUT INSERTED.UserId, INSERTED.Name, INSERTED.Email, INSERTED.Role, INSERTED.CreatedAt
        VALUES (@Name, @Email, @PasswordHash, @Role)
      `);

    const user = inserted.recordset[0];

    await pool.request().input("UserId", sql.Int, user.UserId).query(`
      INSERT INTO UserChecklist (UserId, ItemId, Status)
      SELECT @UserId, ItemId, 'PENDING'
      FROM ChecklistItems
      WHERE IsActive = 1
        AND NOT EXISTS (
          SELECT 1 FROM UserChecklist uc WHERE uc.UserId=@UserId AND uc.ItemId=ChecklistItems.ItemId
        )
    `);

    // auto-assign trainings
    await pool.request().input("UserId", sql.Int, user.UserId).query(`
      INSERT INTO UserTraining (UserId, TrainingId, Attendance)
      SELECT @UserId, TrainingId, 'UPCOMING'
      FROM Trainings
      WHERE NOT EXISTS (
        SELECT 1 FROM UserTraining ut WHERE ut.UserId=@UserId AND ut.TrainingId=Trainings.TrainingId
      )
    `);

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        userId: user.UserId,
        name: user.Name,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res
      .status(500)
      .json({ message: "Server error during registration" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email and password are required" });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Email", sql.NVarChar(200), email)
      .query(
        "SELECT TOP 1 UserId, Name, Email, PasswordHash, Role FROM Users WHERE Email=@Email",
      );

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = result.recordset[0];
    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        userId: user.UserId,
        name: user.Name,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
});

// frontend calls /api/me
app.get("/api/me", authRequired, (req, res) => res.json({ user: req.user }));

function safeUse(routeBase, modulePath) {
  try {
    const r = require(modulePath);
    app.use(routeBase, r);
    console.log("Mounted:", modulePath, "at", routeBase);
  } catch (e) {
    console.log("Skipped missing route:", modulePath);
  }
}

// role ping routes
app.get("/api/hr/ping", authRequired, (req, res) => {
  if (req.user.role !== "HR")
    return res.status(403).json({ message: "Forbidden" });
  res.json({ message: "HR session active" });
});

app.get("/api/employee/ping", authRequired, (req, res) => {
  if (req.user.role !== "EMPLOYEE")
    return res.status(403).json({ message: "Forbidden" });
  res.json({ message: "Employee session active" });
});

safeUse("/api", "./routes/checklistRoutes");
safeUse("/api", "./routes/documentsRoutes");
safeUse("/api", "./routes/trainingsRoutes");
safeUse("/api", "./routes/equipmentRoutes");
safeUse("/api", "./routes/announcementsRoutes");
safeUse("/api", "./routes/faqsRoutes");

// DB connects

(async () => {
  try {
    await getPool();
    console.log("Connected to MSSQL");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("DB connection failed:", err);
    process.exit(1);
  }
})();
