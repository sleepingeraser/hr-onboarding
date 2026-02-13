const { sql, getPool } = require("../config/dbConfig");

class ChecklistModel {
  static tableName = "ChecklistItems";
  static userTableName = "UserChecklist";

  // checklist items methods
  static async findAllItems() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT * FROM ${this.tableName} 
      WHERE IsActive = 1 
      ORDER BY 
        CASE Stage
          WHEN 'DAY1' THEN 1
          WHEN 'WEEK1' THEN 2
          WHEN 'MONTH1' THEN 3
        END
    `);
    return result.recordset;
  }

  static async findItemById(itemId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("ItemId", sql.Int, itemId)
      .query(`SELECT * FROM ${this.tableName} WHERE ItemId = @ItemId`);

    return result.recordset[0] || null;
  }

  static async createItem(itemData) {
    const { title, stage, description } = itemData;

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Title", sql.NVarChar(200), title)
      .input("Stage", sql.NVarChar(20), stage)
      .input("Description", sql.NVarChar(500), description || null).query(`
        INSERT INTO ${this.tableName} (Title, Stage, Description, IsActive)
        OUTPUT INSERTED.*
        VALUES (@Title, @Stage, @Description, 1)
      `);

    return result.recordset[0];
  }

  static async updateItem(itemId, itemData) {
    const pool = await getPool();
    const request = pool.request().input("ItemId", sql.Int, itemId);

    const updates = [];
    if (itemData.title !== undefined) {
      request.input("Title", sql.NVarChar(200), itemData.title);
      updates.push("Title = @Title");
    }
    if (itemData.stage !== undefined) {
      request.input("Stage", sql.NVarChar(20), itemData.stage);
      updates.push("Stage = @Stage");
    }
    if (itemData.description !== undefined) {
      request.input("Description", sql.NVarChar(500), itemData.description);
      updates.push("Description = @Description");
    }
    if (itemData.isActive !== undefined) {
      request.input("IsActive", sql.Bit, itemData.isActive);
      updates.push("IsActive = @IsActive");
    }

    if (updates.length === 0) return null;

    const query = `UPDATE ${this.tableName} SET ${updates.join(", ")} WHERE ItemId = @ItemId`;
    await request.query(query);

    return await this.findItemById(itemId);
  }

  static async deleteItem(itemId) {
    return await this.updateItem(itemId, { isActive: 0 });
  }

  // user checklist methods
  static async getUserChecklist(userId) {
    const pool = await getPool();
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
        SELECT 
          ci.ItemId,
          ci.Title,
          ci.Stage,
          ci.Description,
          uc.Status,
          uc.UpdatedAt
        FROM ChecklistItems ci
        INNER JOIN UserChecklist uc ON ci.ItemId = uc.ItemId
        WHERE uc.UserId = @UserId AND ci.IsActive = 1
        ORDER BY 
          CASE ci.Stage
            WHEN 'DAY1' THEN 1
            WHEN 'WEEK1' THEN 2
            WHEN 'MONTH1' THEN 3
          END
      `);

    return result.recordset;
  }

  static async getUserItemStatus(userId, itemId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("ItemId", sql.Int, itemId)
      .query(
        `SELECT * FROM ${this.userTableName} WHERE UserId = @UserId AND ItemId = @ItemId`,
      );

    return result.recordset[0] || null;
  }

  static async updateUserItemStatus(userId, itemId, status) {
    const pool = await getPool();
    await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("ItemId", sql.Int, itemId)
      .input("Status", sql.NVarChar(20), status)
      .input("UpdatedAt", sql.DateTime2, new Date()).query(`
        UPDATE ${this.userTableName}
        SET Status = @Status, UpdatedAt = @UpdatedAt
        WHERE UserId = @UserId AND ItemId = @ItemId
      `);
  }

  static async initializeUserChecklist(userId) {
    const pool = await getPool();
    await pool.request().input("UserId", sql.Int, userId).query(`
        INSERT INTO ${this.userTableName} (UserId, ItemId, Status)
        SELECT @UserId, ItemId, 'PENDING'
        FROM ${this.tableName}
        WHERE IsActive = 1
          AND NOT EXISTS (
            SELECT 1 FROM ${this.userTableName} uc WHERE uc.UserId=@UserId AND uc.ItemId=ChecklistItems.ItemId
          )
      `);
  }

  static async getUserProgress(userId) {
    const pool = await getPool();
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN Status = 'DONE' THEN 1 ELSE 0 END) as done
        FROM ${this.userTableName}
        WHERE UserId = @UserId
      `);

    const data = result.recordset[0];
    return {
      total: data.total || 0,
      done: data.done || 0,
      percentage: data.total ? Math.round((data.done / data.total) * 100) : 0,
    };
  }
}

module.exports = ChecklistModel;
