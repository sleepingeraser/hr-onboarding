const { getPool, sql } = require("../config/dbConfig");

async function listForRole(role) {
  const p = await getPool();
  const rows = await p.request().input("Role", sql.NVarChar, role).query(`
    SELECT AnnouncementId, Title, Body, Audience, CreatedAt
    FROM Announcements
    WHERE Audience='ALL' OR Audience=@Role
    ORDER BY CreatedAt DESC
  `);
  return rows.recordset;
}

async function createAnnouncement({ title, body, audience, createdByUserId }) {
  const p = await getPool();
  await p
    .request()
    .input("Title", sql.NVarChar, title.trim())
    .input("Body", sql.NVarChar, body)
    .input("Audience", sql.NVarChar, audience)
    .input("CreatedByUserId", sql.Int, createdByUserId).query(`
      INSERT INTO Announcements (Title, Body, Audience, CreatedByUserId)
      VALUES (@Title, @Body, @Audience, @CreatedByUserId)
    `);
}

async function deleteAnnouncement(id) {
  const p = await getPool();
  await p
    .request()
    .input("Id", sql.Int, id)
    .query(`DELETE FROM Announcements WHERE AnnouncementId=@Id`);
}

async function listAllAnnouncements() {
  const p = await getPool();
  const rows = await p.request().query(`
    SELECT AnnouncementId, Title, Body, Audience, CreatedAt
    FROM Announcements
    ORDER BY CreatedAt DESC
  `);
  return rows.recordset;
}

module.exports = {
  listForRole,
  createAnnouncement,
  deleteAnnouncement,
  listAllAnnouncements,
};
