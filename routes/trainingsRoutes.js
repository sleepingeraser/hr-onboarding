const express = require("express");
const router = express.Router();
const { sql, getPool } = require("../config/dbConfig");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  
  try {
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function hrRequired(req, res, next) {
  if (req.user.role !== "HR") {
    return res.status(403).json({ message: "HR access required" });
  }
  next();
}

// get user's trainings
router.get("/trainings", authRequired, async (req, res) => {
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

    res.json({ trainings: result.recordset });
  } catch (err) {
    console.error("GET trainings error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// update training attendance
router.patch(
  "/trainings/:trainingId/attendance",
  authRequired,
  async (req, res) => {
    try {
      const { trainingId } = req.params;
      const { attendance } = req.body;

      if (!["UPCOMING", "ATTENDED"].includes(attendance)) {
        return res
          .status(400)
          .json({ message: "Attendance must be UPCOMING or ATTENDED" });
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

      res.json({ message: "Attendance updated" });
    } catch (err) {
      console.error("PATCH attendance error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: create training
router.post("/hr/trainings", authRequired, hrRequired, async (req, res) => {
  try {
    const { title, startsAt, location, notes } = req.body;

    if (!title || !startsAt) {
      return res.status(400).json({ message: "Title and start time required" });
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

    res.status(201).json({ message: "Training created", trainingId });
  } catch (err) {
    console.error("POST training error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
