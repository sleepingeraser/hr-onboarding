const { sql, getPool } = require("../config/dbConfig");

async function listAnnouncements(req, res) {
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
}

async function hrCreateAnnouncement(req, res) {
  try {
    const { title, body, audience = "ALL" } = req.body || {};
    if (!title || !body)
      return res.status(400).json({ message: "Missing title/body" });
    if (!["ALL", "EMPLOYEE", "HR"].includes(audience)) {
      return res.status(400).json({ message: "Invalid audience" });
    }

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
}

async function hrDeleteAnnouncement(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const p = await getPool();
    await p.request().input("Id", sql.Int, id).query(`
      DELETE FROM Announcements WHERE AnnouncementId=@Id
    `);

    res.json({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListAllAnnouncements(req, res) {
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

module.exports = {
  listAnnouncements,
  hrCreateAnnouncement,
  hrDeleteAnnouncement,
  hrListAllAnnouncements,
};
