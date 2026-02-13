const { sql, getPool } = require("../config/dbConfig");

class FAQsModel {
  static tableName = "FAQs";

  static async findAll() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT * FROM ${this.tableName} 
      WHERE IsActive = 1 
      ORDER BY Category, CreatedAt DESC
    `);
    return result.recordset;
  }

  static async findById(faqId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("FaqId", sql.Int, faqId)
      .query(`SELECT * FROM ${this.tableName} WHERE FaqId = @FaqId`);

    return result.recordset[0] || null;
  }

  static async findByCategory(category) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Category", sql.NVarChar(80), category).query(`
        SELECT * FROM ${this.tableName} 
        WHERE Category = @Category AND IsActive = 1 
        ORDER BY CreatedAt DESC
      `);

    return result.recordset;
  }

  static async findActive() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT * FROM ${this.tableName} 
      WHERE IsActive = 1 
      ORDER BY Category, CreatedAt DESC
    `);
    return result.recordset;
  }

  static async create(faqData) {
    const { question, answer, category } = faqData;

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Question", sql.NVarChar(200), question)
      .input("Answer", sql.NVarChar(sql.MAX), answer)
      .input("Category", sql.NVarChar(80), category || null)
      .input("IsActive", sql.Bit, 1)
      .input("CreatedAt", sql.DateTime2, new Date()).query(`
        INSERT INTO ${this.tableName} (Question, Answer, Category, IsActive, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@Question, @Answer, @Category, @IsActive, @CreatedAt)
      `);

    return result.recordset[0];
  }

  static async update(faqId, faqData) {
    const pool = await getPool();
    const request = pool.request().input("FaqId", sql.Int, faqId);

    const updates = [];
    if (faqData.question !== undefined) {
      request.input("Question", sql.NVarChar(200), faqData.question);
      updates.push("Question = @Question");
    }
    if (faqData.answer !== undefined) {
      request.input("Answer", sql.NVarChar(sql.MAX), faqData.answer);
      updates.push("Answer = @Answer");
    }
    if (faqData.category !== undefined) {
      request.input("Category", sql.NVarChar(80), faqData.category);
      updates.push("Category = @Category");
    }
    if (faqData.isActive !== undefined) {
      request.input("IsActive", sql.Bit, faqData.isActive);
      updates.push("IsActive = @IsActive");
    }

    if (updates.length === 0) return null;

    const query = `UPDATE ${this.tableName} SET ${updates.join(", ")} WHERE FaqId = @FaqId`;
    await request.query(query);

    return await this.findById(faqId);
  }

  static async delete(faqId) {
    // Soft delete - just mark as inactive
    return await this.update(faqId, { isActive: 0 });
  }

  static async permanentlyDelete(faqId) {
    const pool = await getPool();
    await pool
      .request()
      .input("FaqId", sql.Int, faqId)
      .query(`DELETE FROM ${this.tableName} WHERE FaqId = @FaqId`);
  }

  static async count() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM ${this.tableName} WHERE IsActive = 1
    `);
    return result.recordset[0].count;
  }

  static async countByCategory(category) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Category", sql.NVarChar(80), category).query(`
        SELECT COUNT(*) as count FROM ${this.tableName} 
        WHERE Category = @Category AND IsActive = 1
      `);

    return result.recordset[0].count;
  }

  static async getCategories() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT DISTINCT Category FROM ${this.tableName} 
      WHERE IsActive = 1 AND Category IS NOT NULL 
      ORDER BY Category
    `);

    return result.recordset.map((r) => r.Category);
  }
}

module.exports = FAQsModel;
