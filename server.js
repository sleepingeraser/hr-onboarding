const express = require("express");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sql = require("mssql");
const multer = require("multer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "sky";

app.use(cors());
app.use(express.json());

// serve frontend
app.use(express.static(path.join(__dirname, "public")));

// serve uploads
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// ---------- SQL connection ----------
const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: String(process.env.DB_ENCRYPT || "false") === "true",
    trustServerCertificate: true,
  },
};

let pool;
async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(dbConfig);
  return pool;
}

// ---------- auth middleware ----------
function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return res.status(401).json({ message: "Missing or invalid token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function roleRequired(role) {
  return (req, res, next) => {
    if (!req.user?.role || req.user.role !== role) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// ---------- file upload (documents) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "public", "uploads")),
  filename: (req, file, cb) => {
    const safe = Date.now() + "-" + file.originalname.replace(/[^\w.\-]/g, "_");
    cb(null, safe);
  },
});
const upload = multer({ storage });

// ---------- AUTH ----------
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    const cleanEmail = normalizeEmail(email);

    if (!name || !cleanEmail || !password || !role) return res.status(400).json({ message: "Missing fields" });
    if (!["HR", "EMPLOYEE"].includes(role)) return res.status(400).json({ message: "Invalid role" });

    const p = await getPool();

    const exists = await p.request()
      .input("Email", sql.NVarChar, cleanEmail)
      .query("SELECT UserId FROM Users WHERE Email=@Email");

    if (exists.recordset.length) return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);

    await p.request()
      .input("Name", sql.NVarChar, String(name).trim())
      .input("Email", sql.NVarChar, cleanEmail)
      .input("PasswordHash", sql.NVarChar, passwordHash)
      .input("Role", sql.NVarChar, role)
      .query("INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES (@Name, @Email, @PasswordHash, @Role)");

    return res.status(201).json({ message: "Registered successfully" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !password) return res.status(400).json({ message: "Missing email/password" });

    const p = await getPool();
    const result = await p.request()
      .input("Email", sql.NVarChar, cleanEmail)
      .query("SELECT UserId, Name, Email, PasswordHash, Role FROM Users WHERE Email=@Email");

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user.UserId, name: user.Name, email: user.Email, role: user.Role },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      token,
      user: { userId: user.UserId, name: user.Name, email: user.Email, role: user.Role },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/me", authRequired, (req, res) => res.json({ user: req.user }));

app.get("/api/hr/ping", authRequired, roleRequired("HR"), (req, res) => res.json({ message: "Hello HR ✅" }));
app.get("/api/employee/ping", authRequired, roleRequired("EMPLOYEE"), (req, res) => res.json({ message: "Hello Employee ✅" }));

// ---------- CHECKLIST (Employee) ----------
app.get("/api/checklist", authRequired, roleRequired("EMPLOYEE"), async (req, res) => {
  try {
    const p = await getPool();

    // ensure rows exist in UserChecklist for this user (auto-assign all active items)
    await p.request()
      .input("UserId", sql.Int, req.user.userId)
      .query(`
        INSERT INTO UserChecklist (UserId, ItemId)
        SELECT @UserId, c.ItemId
        FROM ChecklistItems c
        WHERE c.IsActive=1
          AND NOT EXISTS (
            SELECT 1 FROM UserChecklist uc
            WHERE uc.UserId=@UserId AND uc.ItemId=c.ItemId
          )
      `);

    const items = await p.request()
      .input("UserId", sql.Int, req.user.userId)
      .query(`
        SELECT c.ItemId, c.Title, c.Stage, c.Description,
               uc.Status, uc.UpdatedAt
        FROM ChecklistItems c
        JOIN UserChecklist uc ON uc.ItemId=c.ItemId AND uc.UserId=@UserId
        WHERE c.IsActive=1
        ORDER BY
          CASE c.Stage WHEN 'DAY1' THEN 1 WHEN 'WEEK1' THEN 2 ELSE 3 END,
          c.ItemId
      `);

    res.json({ items: items.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch("/api/checklist/:itemId", authRequired, roleRequired("EMPLOYEE"), async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const { status } = req.body || {};
    if (!["PENDING", "DONE"].includes(status)) return res.status(400).json({ message: "Invalid status" });

    const p = await getPool();
    await p.request()
      .input("UserId", sql.Int, req.user.userId)
      .input("ItemId", sql.Int, itemId)
      .input("Status", sql.NVarChar, status)
      .query(`
        UPDATE UserChecklist
        SET Status=@Status, UpdatedAt=SYSDATETIME()
        WHERE UserId=@UserId AND ItemId=@ItemId
      `);

    res.json({ message: "Updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------- DOCUMENTS (Employee upload + view) ----------
app.post("/api/documents/upload", authRequired, roleRequired("EMPLOYEE"), upload.single("file"), async (req, res) => {
  try {
    const { docType } = req.body || {};
    if (!docType) return res.status(400).json({ message: "Missing docType" });
    if (!req.file) return res.status(400).json({ message: "Missing file" });

    const fileUrl = `/uploads/${req.file.filename}`;
    const p = await getPool();

    await p.request()
      .input("UserId", sql.Int, req.user.userId)
      .input("DocType", sql.NVarChar, docType)
      .input("FileUrl", sql.NVarChar, fileUrl)
      .query(`
        INSERT INTO Documents (UserId, DocType, FileUrl)
        VALUES (@UserId, @DocType, @FileUrl)
      `);

    res.json({ message: "Uploaded", fileUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/documents/my", authRequired, roleRequired("EMPLOYEE"), async (req, res) => {
  try {
    const p = await getPool();
    const docs = await p.request()
      .input("UserId", sql.Int, req.user.userId)
      .query(`
        SELECT DocId, DocType, FileUrl, Status, HRComment, UploadedAt
        FROM Documents
        WHERE UserId=@UserId
        ORDER BY UploadedAt DESC
      `);

    res.json({ documents: docs.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------- DOCUMENTS (HR review) ----------
app.get("/api/hr/documents/pending", authRequired, roleRequired("HR"), async (req, res) => {
  try {
    const p = await getPool();
    const docs = await p.request().query(`
      SELECT d.DocId, d.DocType, d.FileUrl, d.Status, d.HRComment, d.UploadedAt,
             u.UserId, u.Name, u.Email
      FROM Documents d
      JOIN Users u ON u.UserId=d.UserId
      WHERE d.Status='PENDING'
      ORDER BY d.UploadedAt ASC
    `);

    res.json({ documents: docs.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch("/api/hr/documents/:docId", authRequired, roleRequired("HR"), async (req, res) => {
  try {
    const docId = Number(req.params.docId);
    const { status, comment } = req.body || {};
    if (!["APPROVED", "REJECTED"].includes(status)) return res.status(400).json({ message: "Invalid status" });

    const p = await getPool();
    await p.request()
      .input("DocId", sql.Int, docId)
      .input("Status", sql.NVarChar, status)
      .input("Comment", sql.NVarChar, comment || null)
      .query(`
        UPDATE Documents
        SET Status=@Status, HRComment=@Comment
        WHERE DocId=@DocId
      `);

    res.json({ message: "Updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------- TRAININGS ----------
app.get("/api/trainings", authRequired, roleRequired("EMPLOYEE"), async (req, res) => {
  try {
    const p = await getPool();

    // auto-assign all trainings to user (prototype)
    await p.request()
      .input("UserId", sql.Int, req.user.userId)
      .query(`
        INSERT INTO UserTraining (UserId, TrainingId)
        SELECT @UserId, t.TrainingId
        FROM Trainings t
        WHERE NOT EXISTS (
          SELECT 1 FROM UserTraining ut
          WHERE ut.UserId=@UserId AND ut.TrainingId=t.TrainingId
        )
      `);

    const rows = await p.request()
      .input("UserId", sql.Int, req.user.userId)
      .query(`
        SELECT t.TrainingId, t.Title, t.StartsAt, t.Location, t.Notes,
               ut.Attendance
        FROM Trainings t
        JOIN UserTraining ut ON ut.TrainingId=t.TrainingId AND ut.UserId=@UserId
        ORDER BY t.StartsAt ASC
      `);

    res.json({ trainings: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch("/api/trainings/:trainingId/attendance", authRequired, roleRequired("EMPLOYEE"), async (req, res) => {
  try {
    const trainingId = Number(req.params.trainingId);
    const { attendance } = req.body || {};
    if (!["UPCOMING", "ATTENDED"].includes(attendance)) return res.status(400).json({ message: "Invalid attendance" });

    const p = await getPool();
    await p.request()
      .input("UserId", sql.Int, req.user.userId)
      .input("TrainingId", sql.Int, trainingId)
      .input("Attendance", sql.NVarChar, attendance)
      .query(`
        UPDATE UserTraining
        SET Attendance=@Attendance
        WHERE UserId=@UserId AND TrainingId=@TrainingId
      `);

    res.json({ message: "Updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// HR create training
app.post("/api/hr/trainings", authRequired, roleRequired("HR"), async (req, res) => {
  try {
    const { title, startsAt, location, notes } = req.body || {};
    if (!title || !startsAt) return res.status(400).json({ message: "Missing title/startsAt" });

    const p = await getPool();
    await p.request()
      .input("Title", sql.NVarChar, title)
      .input("StartsAt", sql.DateTime2, new Date(startsAt))
      .input("Location", sql.NVarChar, location || null)
      .input("Notes", sql.NVarChar, notes || null)
      .query(`
        INSERT INTO Trainings (Title, StartsAt, Location, Notes)
        VALUES (@Title, @StartsAt, @Location, @Notes)
      `);

    res.status(201).json({ message: "Training created" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
