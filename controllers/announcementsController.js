const { sql, getPool } = require("../config/dbConfig");

async function listAnnouncements(req, res) {
  try {
    const p = await getPool();
    const rows = await p.request().query(`
      SELECT TOP 10 AnnouncementId, Title, Body, Audience, CreatedAt
      FROM Announcements
      WHERE Audience IN ('ALL','EMPLOYEE')
      ORDER BY CreatedAt DESC
    `);
    res.json({ announcements: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListAll(req, res) {
  try {
    const p = await getPool();
    const rows = await p.request().query(`
      SELECT AnnouncementId, Title, Body, Audience, CreatedAt
      FROM Announcements
      ORDER BY CreatedAt DESC
    `);
    res.json({ announcements: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function createAnnouncement(req, res) {
  try {
    const { title, body, audience } = req.body || {};
    if (!title || !body)
      return res.status(400).json({ message: "Missing title/body" });

    const aud = audience || "ALL";

    const p = await getPool();
    await p
      .request()
      .input("Title", sql.NVarChar, title.trim())
      .input("Body", sql.NVarChar, body)
      .input("Audience", sql.NVarChar, aud).query(`
        INSERT INTO Announcements (Title, Body, Audience)
        VALUES (@Title, @Body, @Audience)
      `);

    res.status(201).json({ message: "Announcement created" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { listAnnouncements, hrListAll, createAnnouncement };
