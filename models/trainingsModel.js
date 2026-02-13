const { sql, getPool } = require("../config/dbConfig");

class TrainingsModel {
  static tableName = "Trainings";
  static userTableName = "UserTraining";

  // training methods
  static async findAll() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT * FROM ${this.tableName} 
      ORDER BY StartsAt ASC
    `);
    return result.recordset;
  }

  static async findById(trainingId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("TrainingId", sql.Int, trainingId)
      .query(`SELECT * FROM ${this.tableName} WHERE TrainingId = @TrainingId`);

    return result.recordset[0] || null;
  }

  static async findUpcoming() {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT * FROM ${this.tableName} 
      WHERE StartsAt > GETDATE() 
      ORDER BY StartsAt ASC
    `);
    return result.recordset;
  }

  static async create(trainingData) {
    const { title, startsAt, location, notes } = trainingData;

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Title", sql.NVarChar(200), title)
      .input("StartsAt", sql.DateTime2, new Date(startsAt))
      .input("Location", sql.NVarChar(200), location || null)
      .input("Notes", sql.NVarChar(500), notes || null).query(`
        INSERT INTO ${this.tableName} (Title, StartsAt, Location, Notes)
        OUTPUT INSERTED.*
        VALUES (@Title, @StartsAt, @Location, @Notes)
      `);

    return result.recordset[0];
  }

  static async update(trainingId, trainingData) {
    const pool = await getPool();
    const request = pool.request().input("TrainingId", sql.Int, trainingId);

    const updates = [];
    if (trainingData.title !== undefined) {
      request.input("Title", sql.NVarChar(200), trainingData.title);
      updates.push("Title = @Title");
    }
    if (trainingData.startsAt !== undefined) {
      request.input("StartsAt", sql.DateTime2, new Date(trainingData.startsAt));
      updates.push("StartsAt = @StartsAt");
    }
    if (trainingData.location !== undefined) {
      request.input("Location", sql.NVarChar(200), trainingData.location);
      updates.push("Location = @Location");
    }
    if (trainingData.notes !== undefined) {
      request.input("Notes", sql.NVarChar(500), trainingData.notes);
      updates.push("Notes = @Notes");
    }

    if (updates.length === 0) return null;

    const query = `UPDATE ${this.tableName} SET ${updates.join(", ")} WHERE TrainingId = @TrainingId`;
    await request.query(query);

    return await this.findById(trainingId);
  }

  static async delete(trainingId) {
    const pool = await getPool();

    // first delete all user associations
    await pool
      .request()
      .input("TrainingId", sql.Int, trainingId)
      .query(
        `DELETE FROM ${this.userTableName} WHERE TrainingId = @TrainingId`,
      );

    // then delete the training
    await pool
      .request()
      .input("TrainingId", sql.Int, trainingId)
      .query(`DELETE FROM ${this.tableName} WHERE TrainingId = @TrainingId`);
  }

  // user Training methods
  static async getUserTrainings(userId) {
    const pool = await getPool();
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
        SELECT 
          t.*,
          ut.Attendance
        FROM ${this.tableName} t
        INNER JOIN ${this.userTableName} ut ON t.TrainingId = ut.TrainingId
        WHERE ut.UserId = @UserId
        ORDER BY t.StartsAt ASC
      `);

    return result.recordset;
  }

  static async getUserUpcomingTrainings(userId) {
    const pool = await getPool();
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
        SELECT 
          t.*,
          ut.Attendance
        FROM ${this.tableName} t
        INNER JOIN ${this.userTableName} ut ON t.TrainingId = ut.TrainingId
        WHERE ut.UserId = @UserId AND t.StartsAt > GETDATE() AND ut.Attendance = 'UPCOMING'
        ORDER BY t.StartsAt ASC
      `);

    return result.recordset;
  }

  static async getUserAttendance(userId, trainingId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("TrainingId", sql.Int, trainingId)
      .query(
        `SELECT * FROM ${this.userTableName} WHERE UserId = @UserId AND TrainingId = @TrainingId`,
      );

    return result.recordset[0] || null;
  }

  static async updateAttendance(userId, trainingId, attendance) {
    const pool = await getPool();
    await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("TrainingId", sql.Int, trainingId)
      .input("Attendance", sql.NVarChar(20), attendance).query(`
        UPDATE ${this.userTableName}
        SET Attendance = @Attendance
        WHERE UserId = @UserId AND TrainingId = @TrainingId
      `);
  }

  static async assignToAllEmployees(trainingId) {
    const pool = await getPool();
    await pool.request().input("TrainingId", sql.Int, trainingId).query(`
        INSERT INTO ${this.userTableName} (UserId, TrainingId, Attendance)
        SELECT UserId, @TrainingId, 'UPCOMING'
        FROM Users
        WHERE Role = 'EMPLOYEE'
          AND NOT EXISTS (
            SELECT 1 FROM ${this.userTableName} ut WHERE ut.UserId=Users.UserId AND ut.TrainingId=@TrainingId
          )
      `);
  }

  static async countAttendees(trainingId, attendance = null) {
    const pool = await getPool();
    const request = pool.request().input("TrainingId", sql.Int, trainingId);

    let query = `SELECT COUNT(*) as count FROM ${this.userTableName} WHERE TrainingId = @TrainingId`;
    if (attendance) {
      request.input("Attendance", sql.NVarChar(20), attendance);
      query += ` AND Attendance = @Attendance`;
    }

    const result = await request.query(query);
    return result.recordset[0].count;
  }
}

module.exports = TrainingsModel;
