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
  if (type !== "Bearer" || !token)
    return res.status(401).json({ message: "Missing or invalid token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function roleRequired(role) {
  return (req, res, next) => {
    if (!req.user?.role || req.user.role !== role)
      return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

// ---------- file upload (documents) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, "public", "uploads")),
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

    if (!name || !cleanEmail || !password || !role)
      return res.status(400).json({ message: "Missing fields" });
    if (!["HR", "EMPLOYEE"].includes(role))
      return res.status(400).json({ message: "Invalid role" });

    const p = await getPool();

    const exists = await p
      .request()
      .input("Email", sql.NVarChar, cleanEmail)
      .query("SELECT UserId FROM Users WHERE Email=@Email");

    if (exists.recordset.length)
      return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);

    await p
      .request()
      .input("Name", sql.NVarChar, String(name).trim())
      .input("Email", sql.NVarChar, cleanEmail)
      .input("PasswordHash", sql.NVarChar, passwordHash)
      .input("Role", sql.NVarChar, role)
      .query(
        "INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES (@Name, @Email, @PasswordHash, @Role)",
      );

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
    if (!cleanEmail || !password)
      return res.status(400).json({ message: "Missing email/password" });

    const p = await getPool();
    const result = await p
      .request()
      .input("Email", sql.NVarChar, cleanEmail)
      .query(
        "SELECT UserId, Name, Email, PasswordHash, Role FROM Users WHERE Email=@Email",
      );

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      {
        userId: user.UserId,
        name: user.Name,
        email: user.Email,
        role: user.Role,
      },
      JWT_SECRET,
      { expiresIn: "2h" },
    );

    return res.json({
      token,
      user: {
        userId: user.UserId,
        name: user.Name,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/me", authRequired, (req, res) => res.json({ user: req.user }));

app.get("/api/hr/ping", authRequired, roleRequired("HR"), (req, res) =>
  res.json({ message: "Hello HR ✅" }),
);
app.get(
  "/api/employee/ping",
  authRequired,
  roleRequired("EMPLOYEE"),
  (req, res) => res.json({ message: "Hello Employee ✅" }),
);

// ---------- CHECKLIST (Employee) ----------
app.get(
  "/api/checklist",
  authRequired,
  roleRequired("EMPLOYEE"),
  async (req, res) => {
    try {
      const p = await getPool();

      // ensure rows exist in UserChecklist for this user (auto-assign all active items)
      await p.request().input("UserId", sql.Int, req.user.userId).query(`
        INSERT INTO UserChecklist (UserId, ItemId)
        SELECT @UserId, c.ItemId
        FROM ChecklistItems c
        WHERE c.IsActive=1
          AND NOT EXISTS (
            SELECT 1 FROM UserChecklist uc
            WHERE uc.UserId=@UserId AND uc.ItemId=c.ItemId
          )
      `);

      const items = await p.request().input("UserId", sql.Int, req.user.userId)
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
  },
);

app.patch(
  "/api/checklist/:itemId",
  authRequired,
  roleRequired("EMPLOYEE"),
  async (req, res) => {
    try {
      const itemId = Number(req.params.itemId);
      const { status } = req.body || {};
      if (!["PENDING", "DONE"].includes(status))
        return res.status(400).json({ message: "Invalid status" });

      const p = await getPool();
      await p
        .request()
        .input("UserId", sql.Int, req.user.userId)
        .input("ItemId", sql.Int, itemId)
        .input("Status", sql.NVarChar, status).query(`
        UPDATE UserChecklist
        SET Status=@Status, UpdatedAt=SYSDATETIME()
        WHERE UserId=@UserId AND ItemId=@ItemId
      `);

      res.json({ message: "Updated" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// ---------- DOCUMENTS (Employee upload + view) ----------
app.post(
  "/api/documents/upload",
  authRequired,
  roleRequired("EMPLOYEE"),
  upload.single("file"),
  async (req, res) => {
    try {
      const { docType } = req.body || {};
      if (!docType) return res.status(400).json({ message: "Missing docType" });
      if (!req.file) return res.status(400).json({ message: "Missing file" });

      const fileUrl = `/uploads/${req.file.filename}`;
      const p = await getPool();

      await p
        .request()
        .input("UserId", sql.Int, req.user.userId)
        .input("DocType", sql.NVarChar, docType)
        .input("FileUrl", sql.NVarChar, fileUrl).query(`
        INSERT INTO Documents (UserId, DocType, FileUrl)
        VALUES (@UserId, @DocType, @FileUrl)
      `);

      res.json({ message: "Uploaded", fileUrl });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.get(
  "/api/documents/my",
  authRequired,
  roleRequired("EMPLOYEE"),
  async (req, res) => {
    try {
      const p = await getPool();
      const docs = await p.request().input("UserId", sql.Int, req.user.userId)
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
  },
);

// ---------- DOCUMENTS (HR review) ----------
app.get(
  "/api/hr/documents/pending",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
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
  },
);

app.patch(
  "/api/hr/documents/:docId",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const docId = Number(req.params.docId);
      const { status, comment } = req.body || {};
      if (!["APPROVED", "REJECTED"].includes(status))
        return res.status(400).json({ message: "Invalid status" });

      const p = await getPool();
      await p
        .request()
        .input("DocId", sql.Int, docId)
        .input("Status", sql.NVarChar, status)
        .input("Comment", sql.NVarChar, comment || null).query(`
        UPDATE Documents
        SET Status=@Status, HRComment=@Comment
        WHERE DocId=@DocId
      `);

      res.json({ message: "Updated" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// ---------- TRAININGS ----------
app.get(
  "/api/trainings",
  authRequired,
  roleRequired("EMPLOYEE"),
  async (req, res) => {
    try {
      const p = await getPool();

      // auto-assign all trainings to user (prototype)
      await p.request().input("UserId", sql.Int, req.user.userId).query(`
        INSERT INTO UserTraining (UserId, TrainingId)
        SELECT @UserId, t.TrainingId
        FROM Trainings t
        WHERE NOT EXISTS (
          SELECT 1 FROM UserTraining ut
          WHERE ut.UserId=@UserId AND ut.TrainingId=t.TrainingId
        )
      `);

      const rows = await p.request().input("UserId", sql.Int, req.user.userId)
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
  },
);

app.patch(
  "/api/trainings/:trainingId/attendance",
  authRequired,
  roleRequired("EMPLOYEE"),
  async (req, res) => {
    try {
      const trainingId = Number(req.params.trainingId);
      const { attendance } = req.body || {};
      if (!["UPCOMING", "ATTENDED"].includes(attendance))
        return res.status(400).json({ message: "Invalid attendance" });

      const p = await getPool();
      await p
        .request()
        .input("UserId", sql.Int, req.user.userId)
        .input("TrainingId", sql.Int, trainingId)
        .input("Attendance", sql.NVarChar, attendance).query(`
        UPDATE UserTraining
        SET Attendance=@Attendance
        WHERE UserId=@UserId AND TrainingId=@TrainingId
      `);

      res.json({ message: "Updated" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR create training
app.post(
  "/api/hr/trainings",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const { title, startsAt, location, notes } = req.body || {};
      if (!title || !startsAt)
        return res.status(400).json({ message: "Missing title/startsAt" });

      const p = await getPool();
      await p
        .request()
        .input("Title", sql.NVarChar, title)
        .input("StartsAt", sql.DateTime2, new Date(startsAt))
        .input("Location", sql.NVarChar, location || null)
        .input("Notes", sql.NVarChar, notes || null).query(`
        INSERT INTO Trainings (Title, StartsAt, Location, Notes)
        VALUES (@Title, @StartsAt, @Location, @Notes)
      `);

      res.status(201).json({ message: "Training created" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// ---------- EQUIPMENT ----------

// HR: create equipment
app.post(
  "/api/hr/equipment",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const { itemName, serialNumber, category } = req.body || {};
      if (!itemName)
        return res.status(400).json({ message: "Missing itemName" });

      const p = await getPool();
      await p
        .request()
        .input("ItemName", sql.NVarChar, itemName.trim())
        .input("SerialNumber", sql.NVarChar, serialNumber || null)
        .input("Category", sql.NVarChar, category || null).query(`
        INSERT INTO Equipment (ItemName, SerialNumber, Category)
        VALUES (@ItemName, @SerialNumber, @Category)
      `);

      res.status(201).json({ message: "Equipment created" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: list equipment
app.get(
  "/api/hr/equipment",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const p = await getPool();
      const rows = await p.request().query(`
      SELECT EquipmentId, ItemName, SerialNumber, Category, Status, CreatedAt
      FROM Equipment
      ORDER BY CreatedAt DESC
    `);
      res.json({ equipment: rows.recordset });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: list employees (for assignment dropdown)
app.get(
  "/api/hr/employees",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const p = await getPool();
      const rows = await p.request().query(`
      SELECT UserId, Name, Email
      FROM Users
      WHERE Role='EMPLOYEE'
      ORDER BY Name ASC
    `);
      res.json({ employees: rows.recordset });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: assign equipment to employee
app.post(
  "/api/hr/equipment/assign",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const { userId, equipmentId, dueBackAt, notes } = req.body || {};
      const uid = Number(userId);
      const eid = Number(equipmentId);
      if (!uid || !eid)
        return res.status(400).json({ message: "Missing userId/equipmentId" });

      const p = await getPool();

      // must be available
      const eq = await p
        .request()
        .input("EquipmentId", sql.Int, eid)
        .query(`SELECT Status FROM Equipment WHERE EquipmentId=@EquipmentId`);
      if (!eq.recordset.length)
        return res.status(404).json({ message: "Equipment not found" });
      if (eq.recordset[0].Status !== "AVAILABLE")
        return res.status(409).json({ message: "Equipment not available" });

      // create assignment + mark assigned
      await p
        .request()
        .input("UserId", sql.Int, uid)
        .input("EquipmentId", sql.Int, eid)
        .input(
          "DueBackAt",
          sql.DateTime2,
          dueBackAt ? new Date(dueBackAt) : null,
        )
        .input("Notes", sql.NVarChar, notes || null).query(`
        INSERT INTO UserEquipment (UserId, EquipmentId, DueBackAt, Notes)
        VALUES (@UserId, @EquipmentId, @DueBackAt, @Notes);

        UPDATE Equipment SET Status='ASSIGNED' WHERE EquipmentId=@EquipmentId;
      `);

      res.status(201).json({ message: "Assigned" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: view assignments
app.get(
  "/api/hr/equipment/assignments",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const p = await getPool();
      const rows = await p.request().query(`
      SELECT ue.AssignmentId, ue.AssignedAt, ue.DueBackAt, ue.Notes, ue.EmployeeAck, ue.ReturnedAt,
             u.UserId, u.Name, u.Email,
             e.EquipmentId, e.ItemName, e.SerialNumber, e.Category
      FROM UserEquipment ue
      JOIN Users u ON u.UserId=ue.UserId
      JOIN Equipment e ON e.EquipmentId=ue.EquipmentId
      ORDER BY ue.AssignedAt DESC
    `);
      res.json({ assignments: rows.recordset });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: mark returned
app.patch(
  "/api/hr/equipment/assignments/:assignmentId/return",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const assignmentId = Number(req.params.assignmentId);
      if (!assignmentId)
        return res.status(400).json({ message: "Invalid assignmentId" });

      const p = await getPool();

      const row = await p
        .request()
        .input("AssignmentId", sql.Int, assignmentId)
        .query(
          `SELECT EquipmentId, ReturnedAt FROM UserEquipment WHERE AssignmentId=@AssignmentId`,
        );
      if (!row.recordset.length)
        return res.status(404).json({ message: "Not found" });
      if (row.recordset[0].ReturnedAt)
        return res.status(409).json({ message: "Already returned" });

      const equipmentId = row.recordset[0].EquipmentId;

      await p
        .request()
        .input("AssignmentId", sql.Int, assignmentId)
        .input("EquipmentId", sql.Int, equipmentId).query(`
        UPDATE UserEquipment SET ReturnedAt=SYSDATETIME() WHERE AssignmentId=@AssignmentId;
        UPDATE Equipment SET Status='AVAILABLE' WHERE EquipmentId=@EquipmentId;
      `);

      res.json({ message: "Returned" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// employee: view my assigned equipment
app.get(
  "/api/equipment/my",
  authRequired,
  roleRequired("EMPLOYEE"),
  async (req, res) => {
    try {
      const p = await getPool();
      const rows = await p.request().input("UserId", sql.Int, req.user.userId)
        .query(`
        SELECT ue.AssignmentId, ue.AssignedAt, ue.DueBackAt, ue.Notes, ue.EmployeeAck, ue.ReturnedAt,
               e.ItemName, e.SerialNumber, e.Category
        FROM UserEquipment ue
        JOIN Equipment e ON e.EquipmentId=ue.EquipmentId
        WHERE ue.UserId=@UserId
        ORDER BY ue.AssignedAt DESC
      `);

      res.json({ equipment: rows.recordset });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// employee: acknowledge receipt
app.patch(
  "/api/equipment/my/:assignmentId/ack",
  authRequired,
  roleRequired("EMPLOYEE"),
  async (req, res) => {
    try {
      const assignmentId = Number(req.params.assignmentId);
      const p = await getPool();
      await p
        .request()
        .input("AssignmentId", sql.Int, assignmentId)
        .input("UserId", sql.Int, req.user.userId).query(`
        UPDATE UserEquipment
        SET EmployeeAck=1
        WHERE AssignmentId=@AssignmentId AND UserId=@UserId
      `);

      res.json({ message: "Acknowledged" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// ---------- ANNOUNCEMENTS ----------
app.get("/api/announcements", authRequired, async (req, res) => {
  try {
    const role = req.user?.role || "EMPLOYEE";
    const p = await getPool();

    const rows = await p.request().input("Role", sql.NVarChar, role).query(`
        SELECT AnnouncementId, Title, Body, Audience, CreatedAt
        FROM Announcements
        WHERE Audience='ALL' OR Audience=@Role
        ORDER BY CreatedAt DESC
      `);

    res.json({ announcements: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: create announcement
app.post(
  "/api/hr/announcements",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const { title, body, audience = "ALL" } = req.body || {};
      if (!title || !body)
        return res.status(400).json({ message: "Missing title/body" });
      if (!["ALL", "EMPLOYEE", "HR"].includes(audience))
        return res.status(400).json({ message: "Invalid audience" });

      const p = await getPool();
      await p
        .request()
        .input("Title", sql.NVarChar, title.trim())
        .input("Body", sql.NVarChar, body)
        .input("Audience", sql.NVarChar, audience)
        .input("CreatedByUserId", sql.Int, req.user.userId).query(`
        INSERT INTO Announcements (Title, Body, Audience, CreatedByUserId)
        VALUES (@Title, @Body, @Audience, @CreatedByUserId)
      `);

      res.status(201).json({ message: "Announcement posted" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: delete announcement
app.delete(
  "/api/hr/announcements/:id",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const p = await getPool();
      await p
        .request()
        .input("Id", sql.Int, id)
        .query(`DELETE FROM Announcements WHERE AnnouncementId=@Id`);
      res.json({ message: "Deleted" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// ---------- FAQ ----------
app.get("/api/faqs", authRequired, async (req, res) => {
  try {
    const p = await getPool();
    const rows = await p.request().query(`
      SELECT FaqId, Question, Answer, Category
      FROM FAQs
      WHERE IsActive=1
      ORDER BY Category ASC, CreatedAt DESC
    `);
    res.json({ faqs: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: create FAQ
app.post("/api/hr/faqs", authRequired, roleRequired("HR"), async (req, res) => {
  try {
    const { question, answer, category } = req.body || {};
    if (!question || !answer)
      return res.status(400).json({ message: "Missing question/answer" });

    const p = await getPool();
    await p
      .request()
      .input("Question", sql.NVarChar, question.trim())
      .input("Answer", sql.NVarChar, answer)
      .input("Category", sql.NVarChar, category || null).query(`
        INSERT INTO FAQs (Question, Answer, Category)
        VALUES (@Question, @Answer, @Category)
      `);

    res.status(201).json({ message: "FAQ created" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: deactivate FAQ
app.patch(
  "/api/hr/faqs/:id/deactivate",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const p = await getPool();
      await p
        .request()
        .input("Id", sql.Int, id)
        .query(`UPDATE FAQs SET IsActive=0 WHERE FaqId=@Id`);
      res.json({ message: "Deactivated" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
