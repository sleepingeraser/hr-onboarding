const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { sql, getPool } = require("../config/dbConfig");

// ensure uploads directory exists
const uploadDir = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}


// configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// auth middleware
function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  try {
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// HR auth middleware
function hrRequired(req, res, next) {
  if (req.user.role !== "HR") {
    return res.status(403).json({ message: "HR access required" });
  }
  next();
}

// get user's documents
router.get("/documents/my", authRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, req.user.userId).query(`
        SELECT 
          DocId,
          DocType,
          FileUrl,
          Status,
          HRComment,
          UploadedAt
        FROM Documents
        WHERE UserId = @UserId
        ORDER BY UploadedAt DESC
      `);

    res.json({ documents: result.recordset });
  } catch (err) {
    console.error("GET my documents error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// upload document
router.post(
  "/documents/upload",
  authRequired,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { docType } = req.body;
      if (!docType) {
        return res.status(400).json({ message: "Document type required" });
      }

      const fileUrl = `/uploads/${req.file.filename}`;

      const pool = await getPool();
      await pool
        .request()
        .input("UserId", sql.Int, req.user.userId)
        .input("DocType", sql.NVarChar(50), docType)
        .input("FileUrl", sql.NVarChar(300), fileUrl).query(`
        INSERT INTO Documents (UserId, DocType, FileUrl, Status)
        VALUES (@UserId, @DocType, @FileUrl, 'PENDING')
      `);

      res.status(201).json({ message: "Document uploaded successfully" });
    } catch (err) {
      console.error("Upload document error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: get pending documents
router.get(
  "/hr/documents/pending",
  authRequired,
  hrRequired,
  async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
      SELECT 
        d.DocId,
        d.DocType,
        d.FileUrl,
        d.Status,
        d.HRComment,
        d.UploadedAt,
        u.UserId,
        u.Name,
        u.Email
      FROM Documents d
      INNER JOIN Users u ON d.UserId = u.UserId
      WHERE d.Status = 'PENDING'
      ORDER BY d.UploadedAt ASC
    `);

      res.json({ documents: result.recordset });
    } catch (err) {
      console.error("GET pending docs error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: update document status
router.patch(
  "/hr/documents/:docId",
  authRequired,
  hrRequired,
  async (req, res) => {
    try {
      const { docId } = req.params;
      const { status, comment } = req.body;

      if (!["APPROVED", "REJECTED"].includes(status)) {
        return res
          .status(400)
          .json({ message: "Status must be APPROVED or REJECTED" });
      }

      const pool = await getPool();
      await pool
        .request()
        .input("DocId", sql.Int, docId)
        .input("Status", sql.NVarChar(20), status)
        .input("Comment", sql.NVarChar(300), comment || null).query(`
        UPDATE Documents
        SET Status = @Status, HRComment = @Comment
        WHERE DocId = @DocId
      `);

      res.json({ message: `Document ${status.toLowerCase()}` });
    } catch (err) {
      console.error("PATCH document error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
