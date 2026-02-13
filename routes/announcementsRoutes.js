const express = require("express");
const router = express.Router();
const { sql, getPool } = require("../config/dbConfig");

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

function hrRequired(req, res, next) {
  if (req.user.role !== "HR") {
    return res.status(403).json({ message: "HR access required" });
  }
  next();
}

// get announcements
router.get("/announcements", authRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Role", sql.NVarChar(20), req.user.role).query(`
        SELECT 
          AnnouncementId,
          Title,
          Body,
          Audience,
          CreatedAt,
          CreatedByUserId
        FROM Announcements
        WHERE Audience = 'ALL' OR Audience = @Role
        ORDER BY CreatedAt DESC
      `);

    res.json({ announcements: result.recordset });
  } catch (err) {
    console.error("GET announcements error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: create announcement
router.post("/hr/announcements", authRequired, hrRequired, async (req, res) => {
  try {
    const { title, body, audience } = req.body;

    if (!title || !body || !audience) {
      return res
        .status(400)
        .json({ message: "Title, body, and audience required" });
    }

    if (!["ALL", "HR", "EMPLOYEE"].includes(audience)) {
      return res.status(400).json({ message: "Invalid audience" });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("Title", sql.NVarChar(120), title)
      .input("Body", sql.NVarChar(sql.MAX), body)
      .input("Audience", sql.NVarChar(20), audience)
      .input("CreatedByUserId", sql.Int, req.user.userId).query(`
        INSERT INTO Announcements (Title, Body, Audience, CreatedByUserId)
        VALUES (@Title, @Body, @Audience, @CreatedByUserId)
      `);

    res.status(201).json({ message: "Announcement created" });
  } catch (err) {
    console.error("POST announcement error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: delete announcement
router.delete(
  "/hr/announcements/:announcementId",
  authRequired,
  hrRequired,
  async (req, res) => {
    try {
      const { announcementId } = req.params;

      const pool = await getPool();
      await pool
        .request()
        .input("AnnouncementId", sql.Int, announcementId)
        .query(
          "DELETE FROM Announcements WHERE AnnouncementId = @AnnouncementId",
        );

      res.json({ message: "Announcement deleted" });
    } catch (err) {
      console.error("DELETE announcement error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
