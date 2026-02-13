const { sql, getPool } = require("../config/dbConfig");

class EquipmentModel {
  static tableName = "Equipment";
  static assignmentTableName = "UserEquipment";

  // equipment methods
  static async findAll() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT * FROM ${this.tableName} 
      ORDER BY CreatedAt DESC
    `);
    return result.recordset;
  }

  static async findById(equipmentId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("EquipmentId", sql.Int, equipmentId)
      .query(
        `SELECT * FROM ${this.tableName} WHERE EquipmentId = @EquipmentId`,
      );

    return result.recordset[0] || null;
  }

  static async findAvailable() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT * FROM ${this.tableName} 
      WHERE Status = 'AVAILABLE' 
      ORDER BY CreatedAt DESC
    `);
    return result.recordset;
  }

  static async findByStatus(status) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Status", sql.NVarChar(20), status).query(`
        SELECT * FROM ${this.tableName} 
        WHERE Status = @Status 
        ORDER BY CreatedAt DESC
      `);

    return result.recordset;
  }

  static async create(equipmentData) {
    const { itemName, serialNumber, category } = equipmentData;

    const pool = await getPool();
    const result = await pool
      .request()
      .input("ItemName", sql.NVarChar(120), itemName)
      .input("SerialNumber", sql.NVarChar(120), serialNumber || null)
      .input("Category", sql.NVarChar(50), category || null)
      .input("Status", sql.NVarChar(20), "AVAILABLE")
      .input("CreatedAt", sql.DateTime2, new Date()).query(`
        INSERT INTO ${this.tableName} (ItemName, SerialNumber, Category, Status, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@ItemName, @SerialNumber, @Category, @Status, @CreatedAt)
      `);

    return result.recordset[0];
  }

  static async update(equipmentId, equipmentData) {
    const pool = await getPool();
    const request = pool.request().input("EquipmentId", sql.Int, equipmentId);

    const updates = [];
    if (equipmentData.itemName !== undefined) {
      request.input("ItemName", sql.NVarChar(120), equipmentData.itemName);
      updates.push("ItemName = @ItemName");
    }
    if (equipmentData.serialNumber !== undefined) {
      request.input(
        "SerialNumber",
        sql.NVarChar(120),
        equipmentData.serialNumber,
      );
      updates.push("SerialNumber = @SerialNumber");
    }
    if (equipmentData.category !== undefined) {
      request.input("Category", sql.NVarChar(50), equipmentData.category);
      updates.push("Category = @Category");
    }
    if (equipmentData.status !== undefined) {
      request.input("Status", sql.NVarChar(20), equipmentData.status);
      updates.push("Status = @Status");
    }

    if (updates.length === 0) return null;

    const query = `UPDATE ${this.tableName} SET ${updates.join(", ")} WHERE EquipmentId = @EquipmentId`;
    await request.query(query);

    return await this.findById(equipmentId);
  }

  static async updateStatus(equipmentId, status) {
    return await this.update(equipmentId, { status });
  }

  static async delete(equipmentId) {
    const pool = await getPool();
    await pool
      .request()
      .input("EquipmentId", sql.Int, equipmentId)
      .query(`DELETE FROM ${this.tableName} WHERE EquipmentId = @EquipmentId`);
  }

  static async count() {
    const pool = await getPool();
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM ${this.tableName}`,
    );
    return result.recordset[0].count;
  }

  static async countByStatus(status) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Status", sql.NVarChar(20), status)
      .query(
        `SELECT COUNT(*) as count FROM ${this.tableName} WHERE Status = @Status`,
      );

    return result.recordset[0].count;
  }

  // assignment methods
  static async getAssignments() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT 
        ue.AssignmentId,
        u.Name,
        u.Email,
        e.ItemName,
        e.SerialNumber,
        ue.AssignedAt,
        ue.DueBackAt,
        ue.Notes,
        ue.EmployeeAck,
        ue.ReturnedAt
      FROM ${this.assignmentTableName} ue
      INNER JOIN Users u ON ue.UserId = u.UserId
      INNER JOIN ${this.tableName} e ON ue.EquipmentId = e.EquipmentId
      ORDER BY ue.AssignedAt DESC
    `);
    return result.recordset;
  }

  static async getUserEquipment(userId) {
    const pool = await getPool();
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
        SELECT 
          ue.AssignmentId,
          e.*,
          ue.AssignedAt,
          ue.DueBackAt,
          ue.Notes,
          ue.EmployeeAck,
          ue.ReturnedAt
        FROM ${this.assignmentTableName} ue
        INNER JOIN ${this.tableName} e ON ue.EquipmentId = e.EquipmentId
        WHERE ue.UserId = @UserId
        ORDER BY ue.AssignedAt DESC
      `);

    return result.recordset;
  }

  static async getCurrentUserEquipment(userId) {
    const pool = await getPool();
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
        SELECT 
          ue.AssignmentId,
          e.*,
          ue.AssignedAt,
          ue.DueBackAt,
          ue.Notes,
          ue.EmployeeAck
        FROM ${this.assignmentTableName} ue
        INNER JOIN ${this.tableName} e ON ue.EquipmentId = e.EquipmentId
        WHERE ue.UserId = @UserId AND ue.ReturnedAt IS NULL
        ORDER BY ue.AssignedAt DESC
      `);

    return result.recordset;
  }

  static async getAssignmentById(assignmentId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("AssignmentId", sql.Int, assignmentId)
      .query(
        `SELECT * FROM ${this.assignmentTableName} WHERE AssignmentId = @AssignmentId`,
      );

    return result.recordset[0] || null;
  }

  static async assign(assignmentData) {
    const { userId, equipmentId, dueBackAt, notes } = assignmentData;

    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("EquipmentId", sql.Int, equipmentId)
      .input("DueBackAt", sql.DateTime2, dueBackAt ? new Date(dueBackAt) : null)
      .input("Notes", sql.NVarChar(250), notes || null)
      .input("AssignedAt", sql.DateTime2, new Date())
      .input("EmployeeAck", sql.Bit, 0).query(`
        INSERT INTO ${this.assignmentTableName} (UserId, EquipmentId, AssignedAt, DueBackAt, Notes, EmployeeAck)
        OUTPUT INSERTED.*
        VALUES (@UserId, @EquipmentId, @AssignedAt, @DueBackAt, @Notes, @EmployeeAck)
      `);

    return result.recordset[0];
  }

  static async acknowledge(assignmentId, userId) {
    const pool = await getPool();
    await pool
      .request()
      .input("AssignmentId", sql.Int, assignmentId)
      .input("UserId", sql.Int, userId).query(`
        UPDATE ${this.assignmentTableName}
        SET EmployeeAck = 1
        WHERE AssignmentId = @AssignmentId AND UserId = @UserId AND ReturnedAt IS NULL
      `);
  }

  static async markReturned(assignmentId) {
    const pool = await getPool();

    // get the equipment ID first
    const assignment = await this.getAssignmentById(assignmentId);
    if (!assignment) return null;

    // mark as returned
    await pool
      .request()
      .input("AssignmentId", sql.Int, assignmentId)
      .input("ReturnedAt", sql.DateTime2, new Date()).query(`
        UPDATE ${this.assignmentTableName}
        SET ReturnedAt = @ReturnedAt
        WHERE AssignmentId = @AssignmentId
      `);

    // update equipment status
    await this.updateStatus(assignment.EquipmentId, "AVAILABLE");

    return assignment;
  }

  static async countActiveAssignments() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM ${this.assignmentTableName} WHERE ReturnedAt IS NULL
    `);
    return result.recordset[0].count;
  }

  static async countUserActiveAssignments(userId) {
    const pool = await getPool();
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
        SELECT COUNT(*) as count FROM ${this.assignmentTableName} 
        WHERE UserId = @UserId AND ReturnedAt IS NULL
      `);

    return result.recordset[0].count;
  }

  static async countUnacknowledged(userId) {
    const pool = await getPool();
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
        SELECT COUNT(*) as count FROM ${this.assignmentTableName} 
        WHERE UserId = @UserId AND ReturnedAt IS NULL AND EmployeeAck = 0
      `);

    return result.recordset[0].count;
  }
}

module.exports = EquipmentModel;
