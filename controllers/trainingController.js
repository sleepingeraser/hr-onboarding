const { sql, getPool } = require("../config/dbConfig");

async function listHRTrainings(req, res) {
  try {
    const p = await getPool();
    const rows = await p.request().query(`
      SELECT TOP 50 TrainingId, Title, StartsAt, Location, Notes
      FROM Trainings
      ORDER BY StartsAt DESC
    `);
    res.json({ trainings: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function createTraining(req, res) {
  try {
    const { title, startsAt, location, notes } = req.body || {};
    if (!title || !startsAt)
      return res.status(400).json({ message: "Missing title/startsAt" });

    const p = await getPool();
    await p
      .request()
      .input("Title", sql.NVarChar, title.trim())
      .input("StartsAt", sql.DateTime2, new Date(startsAt))
      .input("Location", sql.NVarChar, location || null)
      .input("Notes", sql.NVarChar, notes || null).query(`
        INSERT INTO Trainings (Title, StartsAt, Location, Notes)
        VALUES (@Title, @StartsAt, @Location, @Notes)
      `);

    res.status(201).json({ message: "Training created" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function myTrainings(req, res) {
  try {
    const p = await getPool();
    const rows = await p.request().input("UserId", sql.Int, req.user.userId)
      .query(`
        SELECT TOP 50 t.TrainingId, t.Title, t.StartsAt, t.Location,
               ut.Attendance
        FROM UserTrainings ut
        JOIN Trainings t ON t.TrainingId = ut.TrainingId
        WHERE ut.UserId=@UserId
        ORDER BY t.StartsAt DESC
      `);

    res.json({ trainings: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function updateAttendance(req, res) {
  try {
    const trainingId = Number(req.params.trainingId);
    const { attendance } = req.body || {};

    if (!trainingId)
      return res.status(400).json({ message: "Invalid trainingId" });
    if (!["GOING", "NOT_GOING", "UNDECIDED"].includes(attendance))
      return res.status(400).json({ message: "Invalid attendance" });

    const p = await getPool();
    await p
      .request()
      .input("UserId", sql.Int, req.user.userId)
      .input("TrainingId", sql.Int, trainingId)
      .input("Attendance", sql.NVarChar, attendance).query(`
        UPDATE UserTrainings
        SET Attendance=@Attendance, UpdatedAt=SYSDATETIME()
        WHERE UserId=@UserId AND TrainingId=@TrainingId
      `);

    res.json({ message: "Updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  listHRTrainings,
  createTraining,
  myTrainings,
  updateAttendance,
};
