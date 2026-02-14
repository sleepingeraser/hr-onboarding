const { sql, getPool } = require("../config/dbConfig");

async function getTrainings(req, res) {
  try {
    console.log("Getting trainings for user:", req.user.userId);

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
          ISNULL(ut.Attendance, 'UPCOMING') as Attendance
        FROM Trainings t
        LEFT JOIN UserTraining ut ON t.TrainingId = ut.TrainingId AND ut.UserId = @UserId
        WHERE ut.UserId = @UserId OR t.TrainingId IN (
          SELECT TrainingId FROM Trainings 
          WHERE NOT EXISTS (SELECT 1 FROM UserTraining WHERE TrainingId = t.TrainingId AND UserId = @UserId)
        )
        ORDER BY t.StartsAt ASC
      `);

    console.log(`Found ${result.recordset.length} trainings for user`);

    res.json({
      success: true,
      trainings: result.recordset,
    });
  } catch (err) {
    console.error("GET trainings error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
}

async function updateAttendance(req, res) {
  try {
    const { trainingId } = req.params;
    const { attendance } = req.body;

    console.log(
      `Updating attendance for training ${trainingId} to ${attendance}`,
    );

    if (!["UPCOMING", "ATTENDED"].includes(attendance)) {
      return res.status(400).json({
        success: false,
        message: "Attendance must be UPCOMING or ATTENDED",
      });
    }

    const pool = await getPool();

    // Check if the record exists
    const checkResult = await pool
      .request()
      .input("UserId", sql.Int, req.user.userId)
      .input("TrainingId", sql.Int, trainingId).query(`
        SELECT * FROM UserTraining 
        WHERE UserId = @UserId AND TrainingId = @TrainingId
      `);

    if (checkResult.recordset.length === 0) {
      // Insert if doesn't exist
      await pool
        .request()
        .input("UserId", sql.Int, req.user.userId)
        .input("TrainingId", sql.Int, trainingId)
        .input("Attendance", sql.NVarChar(20), attendance).query(`
          INSERT INTO UserTraining (UserId, TrainingId, Attendance)
          VALUES (@UserId, @TrainingId, @Attendance)
        `);
    } else {
      // Update if exists
      await pool
        .request()
        .input("UserId", sql.Int, req.user.userId)
        .input("TrainingId", sql.Int, trainingId)
        .input("Attendance", sql.NVarChar(20), attendance).query(`
          UPDATE UserTraining
          SET Attendance = @Attendance
          WHERE UserId = @UserId AND TrainingId = @TrainingId
        `);
    }

    console.log("Attendance updated successfully");

    res.json({
      success: true,
      message: "Attendance updated",
    });
  } catch (err) {
    console.error("PATCH attendance error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
}

async function createTraining(req, res) {
  try {
    const { title, startsAt, location, notes } = req.body;

    console.log("Creating training with data:", {
      title,
      startsAt,
      location,
      notes,
    });

    if (!title || !startsAt) {
      console.log("Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Title and start time required",
      });
    }

    const pool = await getPool();

    // Insert the training
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
    console.log("Training created with ID:", trainingId);

    // Check if there are any employees to assign to
    const employees = await pool
      .request()
      .query("SELECT UserId FROM Users WHERE Role = 'EMPLOYEE'");

    console.log(
      `Found ${employees.recordset.length} employees to assign training to`,
    );

    if (employees.recordset.length > 0) {
      // assign to all employees
      const assignResult = await pool
        .request()
        .input("TrainingId", sql.Int, trainingId).query(`
          INSERT INTO UserTraining (UserId, TrainingId, Attendance)
          SELECT UserId, @TrainingId, 'UPCOMING'
          FROM Users
          WHERE Role = 'EMPLOYEE'
            AND NOT EXISTS (
              SELECT 1 FROM UserTraining ut 
              WHERE ut.UserId = Users.UserId AND ut.TrainingId = @TrainingId
            )
        `);

      console.log(
        `Assigned training to ${assignResult.rowsAffected[0]} employees`,
      );
    }

    res.status(201).json({
      success: true,
      message: "Training created successfully",
      trainingId,
    });
  } catch (err) {
    console.error("POST training error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
}

module.exports = {
  getTrainings,
  updateAttendance,
  createTraining,
};
