const { sql, getPool } = require("../config/dbConfig");

async function getTrainings(req, res) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, req.user.userId).query(`
        SELECT 
          t.TrainingId,
          t.Title,
          t.StartsAt,
          t.Location,
          t.Notes,
          ut.Attendance
        FROM Trainings t
        INNER JOIN UserTraining ut ON t.TrainingId = ut.TrainingId
        WHERE ut.UserId = @UserId
        ORDER BY t.StartsAt ASC
      `);

    res.json({
      success: true,
      trainings: result.recordset,
    });
  } catch (err) {
    console.error("GET trainings error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function updateAttendance(req, res) {
  try {
    const { trainingId } = req.params;
    const { attendance } = req.body;

    if (!["UPCOMING", "ATTENDED"].includes(attendance)) {
      return res.status(400).json({
        success: false,
        message: "Attendance must be UPCOMING or ATTENDED",
      });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("UserId", sql.Int, req.user.userId)
      .input("TrainingId", sql.Int, trainingId)
      .input("Attendance", sql.NVarChar(20), attendance).query(`
        UPDATE UserTraining
        SET Attendance = @Attendance
        WHERE UserId = @UserId AND TrainingId = @TrainingId
      `);

    res.json({
      success: true,
      message: "Attendance updated",
    });
  } catch (err) {
    console.error("PATCH attendance error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function createTraining(req, res) {
  try {
    const { title, startsAt, location, notes } = req.body;

    if (!title || !startsAt) {
      return res.status(400).json({
        success: false,
        message: "Title and start time required",
      });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Title", sql.NVarChar(200), title)
      .input("StartsAt", sql.DateTime2, new Date(startsAt))
      .input("Location", sql.NVarChar(200), location || null)
      .input("Notes", sql.NVarChar(500), notes || null).query(`
        INSERT INTO Trainings (Title, StartsAt, Location, Notes)
        OUTPUT INSERTED.TrainingId
        VALUES (@Title, @StartsAt, @Location, @Notes)
      `);

    const trainingId = result.recordset[0].TrainingId;

    // assign to all employees
    await pool.request().input("TrainingId", sql.Int, trainingId).query(`
        INSERT INTO UserTraining (UserId, TrainingId, Attendance)
        SELECT UserId, @TrainingId, 'UPCOMING'
        FROM Users
        WHERE Role = 'EMPLOYEE'
      `);

    res.status(201).json({
      success: true,
      message: "Training created",
      trainingId,
    });
  } catch (err) {
    console.error("POST training error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = {
  getTrainings,
  updateAttendance,
  createTraining,
};
