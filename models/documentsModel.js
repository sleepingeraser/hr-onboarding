const { sql, getPool } = require("../config/dbConfig");

class DocumentsModel {
  static tableName = "Documents";

  static async findById(docId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("DocId", sql.Int, docId)
      .query(`SELECT * FROM ${this.tableName} WHERE DocId = @DocId`);

    return result.recordset[0] || null;
  }

  static async findByUser(userId) {
    const pool = await getPool();
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
        SELECT * FROM ${this.tableName} 
        WHERE UserId = @UserId 
        ORDER BY UploadedAt DESC
      `);

    return result.recordset;
  }

  static async findPending() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT 
        d.*,
        u.Name,
        u.Email
      FROM ${this.tableName} d
      INNER JOIN Users u ON d.UserId = u.UserId
      WHERE d.Status = 'PENDING'
      ORDER BY d.UploadedAt ASC
    `);

    return result.recordset;
  }

  static async findByStatus(userId, status) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("Status", sql.NVarChar(20), status).query(`
        SELECT * FROM ${this.tableName} 
        WHERE UserId = @UserId AND Status = @Status 
        ORDER BY UploadedAt DESC
      `);

    return result.recordset;
  }

  static async create(documentData) {
    const { userId, docType, fileUrl } = documentData;

    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("DocType", sql.NVarChar(50), docType)
      .input("FileUrl", sql.NVarChar(300), fileUrl)
      .input("Status", sql.NVarChar(20), "PENDING")
      .input("UploadedAt", sql.DateTime2, new Date()).query(`
        INSERT INTO ${this.tableName} (UserId, DocType, FileUrl, Status, UploadedAt)
        OUTPUT INSERTED.*
        VALUES (@UserId, @DocType, @FileUrl, @Status, @UploadedAt)
      `);

    return result.recordset[0];
  }

  static async updateStatus(docId, status, comment = null) {
    const pool = await getPool();
    const request = pool
      .request()
      .input("DocId", sql.Int, docId)
      .input("Status", sql.NVarChar(20), status);

    let query = `UPDATE ${this.tableName} SET Status = @Status`;

    if (comment !== null) {
      request.input("Comment", sql.NVarChar(300), comment);
      query += `, HRComment = @Comment`;
    }

    query += ` WHERE DocId = @DocId`;

    await request.query(query);
    return await this.findById(docId);
  }

  static async countByUser(userId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query(
        `SELECT COUNT(*) as count FROM ${this.tableName} WHERE UserId = @UserId`,
      );

    return result.recordset[0].count;
  }

  static async countPendingByUser(userId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query(
        `SELECT COUNT(*) as count FROM ${this.tableName} WHERE UserId = @UserId AND Status = 'PENDING'`,
      );

    return result.recordset[0].count;
  }

  static async countPending() {
    const pool = await getPool();
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE Status = 'PENDING'`,
    );
    return result.recordset[0].count;
  }

  static async delete(docId) {
    const pool = await getPool();
    await pool
      .request()
      .input("DocId", sql.Int, docId)
      .query(`DELETE FROM ${this.tableName} WHERE DocId = @DocId`);
  }
}

module.exports = DocumentsModel;
