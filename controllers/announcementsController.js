const { sql, getPool } = require("../config/dbConfig");

async function getAnnouncements(req, res) {
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

    res.json({
      success: true,
      announcements: result.recordset,
    });
  } catch (err) {
    console.error("GET announcements error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function createAnnouncement(req, res) {
  try {
    const { title, body, audience } = req.body;

    if (!title || !body || !audience) {
      return res.status(400).json({
        success: false,
        message: "Title, body, and audience required",
      });
    }

    if (!["ALL", "HR", "EMPLOYEE"].includes(audience)) {
      return res.status(400).json({
        success: false,
        message: "Invalid audience",
      });
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

    res.status(201).json({
      success: true,
      message: "Announcement created",
    });
  } catch (err) {
    console.error("POST announcement error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function deleteAnnouncement(req, res) {
  try {
    const { announcementId } = req.params;

    const pool = await getPool();
    await pool
      .request()
      .input("AnnouncementId", sql.Int, announcementId)
      .query(
        "DELETE FROM Announcements WHERE AnnouncementId = @AnnouncementId",
      );

    res.json({
      success: true,
      message: "Announcement deleted",
    });
  } catch (err) {
    console.error("DELETE announcement error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
};
