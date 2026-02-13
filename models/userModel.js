const { sql, getPool } = require("../config/dbConfig");

class UserModel {
  static tableName = "Users";

  static async findById(userId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query(`SELECT * FROM ${this.tableName} WHERE UserId = @UserId`);

    return result.recordset[0] || null;
  }

  static async findByEmail(email) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Email", sql.NVarChar(200), email)
      .query(`SELECT * FROM ${this.tableName} WHERE Email = @Email`);

    return result.recordset[0] || null;
  }

  static async findAll(role = null) {
    const pool = await getPool();
    let query = `SELECT * FROM ${this.tableName}`;

    if (role) {
      query += ` WHERE Role = @Role`;
    }
    query += ` ORDER BY CreatedAt DESC`;

    const request = pool.request();
    if (role) {
      request.input("Role", sql.NVarChar(20), role);
    }

    const result = await request.query(query);
    return result.recordset;
  }

  static async findAllEmployees() {
    return await this.findAll("EMPLOYEE");
  }

  static async findAllHR() {
    return await this.findAll("HR");
  }

  static async create(userData) {
    const { name, email, passwordHash, role } = userData;

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Name", sql.NVarChar(120), name)
      .input("Email", sql.NVarChar(200), email)
      .input("PasswordHash", sql.NVarChar(200), passwordHash)
      .input("Role", sql.NVarChar(20), role).query(`
        INSERT INTO ${this.tableName} (Name, Email, PasswordHash, Role)
        OUTPUT INSERTED.*
        VALUES (@Name, @Email, @PasswordHash, @Role)
      `);

    return result.recordset[0];
  }

  static async update(userId, userData) {
    const pool = await getPool();
    const request = pool.request().input("UserId", sql.Int, userId);

    const updates = [];
    if (userData.name !== undefined) {
      request.input("Name", sql.NVarChar(120), userData.name);
      updates.push("Name = @Name");
    }
    if (userData.email !== undefined) {
      request.input("Email", sql.NVarChar(200), userData.email);
      updates.push("Email = @Email");
    }
    if (userData.passwordHash !== undefined) {
      request.input("PasswordHash", sql.NVarChar(200), userData.passwordHash);
      updates.push("PasswordHash = @PasswordHash");
    }
    if (userData.role !== undefined) {
      request.input("Role", sql.NVarChar(20), userData.role);
      updates.push("Role = @Role");
    }

    if (updates.length === 0) return null;

    const query = `UPDATE ${this.tableName} SET ${updates.join(", ")} WHERE UserId = @UserId`;
    await request.query(query);

    return await this.findById(userId);
  }

  static async delete(userId) {
    const pool = await getPool();
    await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query(`DELETE FROM ${this.tableName} WHERE UserId = @UserId`);
  }

  static async count() {
    const pool = await getPool();
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM ${this.tableName}`,
    );
    return result.recordset[0].count;
  }

  static async countByRole(role) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Role", sql.NVarChar(20), role)
      .query(
        `SELECT COUNT(*) as count FROM ${this.tableName} WHERE Role = @Role`,
      );

    return result.recordset[0].count;
  }

  static async getEmployeeSummary() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT 
        u.UserId,
        u.Name,
        u.Email,
        u.Role,
        u.CreatedAt,
        (SELECT COUNT(*) FROM UserChecklist WHERE UserId = u.UserId) as ChecklistTotal,
        (SELECT COUNT(*) FROM UserChecklist WHERE UserId = u.UserId AND Status = 'DONE') as ChecklistDone,
        (SELECT COUNT(*) FROM Documents WHERE UserId = u.UserId AND Status = 'PENDING') as PendingDocs,
        (SELECT COUNT(*) FROM UserEquipment WHERE UserId = u.UserId AND ReturnedAt IS NULL) as BorrowingNow,
        (SELECT TOP 1 ItemName FROM UserEquipment ue 
         INNER JOIN Equipment e ON ue.EquipmentId = e.EquipmentId 
         WHERE ue.UserId = u.UserId ORDER BY ue.AssignedAt DESC) as LastItemName,
        (SELECT TOP 1 SerialNumber FROM UserEquipment ue 
         INNER JOIN Equipment e ON ue.EquipmentId = e.EquipmentId 
         WHERE ue.UserId = u.UserId ORDER BY ue.AssignedAt DESC) as LastSerialNumber,
        (SELECT TOP 1 AssignedAt FROM UserEquipment 
         WHERE UserId = u.UserId ORDER BY AssignedAt DESC) as LastAssignedAt,
        (SELECT TOP 1 ReturnedAt FROM UserEquipment 
         WHERE UserId = u.UserId ORDER BY ReturnedAt DESC) as LastReturnedAt,
        (SELECT TOP 1 EmployeeAck FROM UserEquipment 
         WHERE UserId = u.UserId ORDER BY AssignedAt DESC) as LastEmployeeAck
      FROM Users u
      WHERE u.Role = 'EMPLOYEE'
      ORDER BY u.CreatedAt DESC
    `);

    return result.recordset;
  }
}

module.exports = UserModel;
