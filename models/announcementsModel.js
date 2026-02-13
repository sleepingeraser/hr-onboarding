const { sql, getPool } = require("../config/dbConfig");

class AnnouncementsModel {
  static tableName = "Announcements";

  static async findAll() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT * FROM ${this.tableName} 
      ORDER BY CreatedAt DESC
    `);
    return result.recordset;
  }

  static async findById(announcementId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("AnnouncementId", sql.Int, announcementId)
      .query(
        `SELECT * FROM ${this.tableName} WHERE AnnouncementId = @AnnouncementId`,
      );

    return result.recordset[0] || null;
  }

  static async findByAudience(role) {
    const pool = await getPool();
    const result = await pool.request().input("Role", sql.NVarChar(20), role)
      .query(`
        SELECT * FROM ${this.tableName} 
        WHERE Audience = 'ALL' OR Audience = @Role 
        ORDER BY CreatedAt DESC
      `);

    return result.recordset;
  }

  static async findLatest(limit = 5) {
    const pool = await getPool();
    const result = await pool.request().input("Limit", sql.Int, limit).query(`
        SELECT TOP (@Limit) * FROM ${this.tableName} 
        ORDER BY CreatedAt DESC
      `);

    return result.recordset;
  }

  static async create(announcementData) {
    const { title, body, audience, createdByUserId } = announcementData;

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Title", sql.NVarChar(120), title)
      .input("Body", sql.NVarChar(sql.MAX), body)
      .input("Audience", sql.NVarChar(20), audience)
      .input("CreatedByUserId", sql.Int, createdByUserId)
      .input("CreatedAt", sql.DateTime2, new Date()).query(`
        INSERT INTO ${this.tableName} (Title, Body, Audience, CreatedByUserId, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@Title, @Body, @Audience, @CreatedByUserId, @CreatedAt)
      `);

    return result.recordset[0];
  }

  static async update(announcementId, announcementData) {
    const pool = await getPool();
    const request = pool
      .request()
      .input("AnnouncementId", sql.Int, announcementId);

    const updates = [];
    if (announcementData.title !== undefined) {
      request.input("Title", sql.NVarChar(120), announcementData.title);
      updates.push("Title = @Title");
    }
    if (announcementData.body !== undefined) {
      request.input("Body", sql.NVarChar(sql.MAX), announcementData.body);
      updates.push("Body = @Body");
    }
    if (announcementData.audience !== undefined) {
      request.input("Audience", sql.NVarChar(20), announcementData.audience);
      updates.push("Audience = @Audience");
    }

    if (updates.length === 0) return null;

    const query = `UPDATE ${this.tableName} SET ${updates.join(", ")} WHERE AnnouncementId = @AnnouncementId`;
    await request.query(query);

    return await this.findById(announcementId);
  }

  static async delete(announcementId) {
    const pool = await getPool();
    await pool
      .request()
      .input("AnnouncementId", sql.Int, announcementId)
      .query(
        `DELETE FROM ${this.tableName} WHERE AnnouncementId = @AnnouncementId`,
      );
  }

  static async count() {
    const pool = await getPool();
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM ${this.tableName}`,
    );
    return result.recordset[0].count;
  }

  static async countByAudience(audience) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Audience", sql.NVarChar(20), audience)
      .query(
        `SELECT COUNT(*) as count FROM ${this.tableName} WHERE Audience = @Audience`,
      );

    return result.recordset[0].count;
  }
}

module.exports = AnnouncementsModel;
