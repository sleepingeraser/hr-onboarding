const { getPool, sql } = require("../config/dbConfig");

async function hrListTrainings(limit = 50) {
  const p = await getPool();
  const rows = await p.request().query(`
    SELECT TOP (${Number(limit) || 50})
      TrainingId, Title, StartsAt, Location, Notes
    FROM Trainings
    ORDER BY StartsAt DESC
  `);
  return rows.recordset;
}

async function hrCreateTraining({ title, startsAt, location, notes }) {
  const p = await getPool();
  await p
    .request()
    .input("Title", sql.NVarChar, title)
    .input("StartsAt", sql.DateTime2, new Date(startsAt))
    .input("Location", sql.NVarChar, location || null)
    .input("Notes", sql.NVarChar, notes || null).query(`
      INSERT INTO Trainings (Title, StartsAt, Location, Notes)
      VALUES (@Title, @StartsAt, @Location, @Notes)
    `);
}

async function ensureUserTrainingRows(userId) {
  const p = await getPool();
  await p.request().input("UserId", sql.Int, userId).query(`
    INSERT INTO UserTraining (UserId, TrainingId)
    SELECT @UserId, t.TrainingId
    FROM Trainings t
    WHERE NOT EXISTS (
      SELECT 1 FROM UserTraining ut
      WHERE ut.UserId=@UserId AND ut.TrainingId=t.TrainingId
    )
  `);
}

async function listEmployeeTrainings(userId) {
  const p = await getPool();
  const rows = await p.request().input("UserId", sql.Int, userId).query(`
    SELECT t.TrainingId, t.Title, t.StartsAt, t.Location, t.Notes,
           ut.Attendance
    FROM Trainings t
    JOIN UserTraining ut ON ut.TrainingId=t.TrainingId AND ut.UserId=@UserId
    ORDER BY t.StartsAt ASC
  `);
  return rows.recordset;
}

async function updateAttendance(userId, trainingId, attendance) {
  const p = await getPool();
  await p
    .request()
    .input("UserId", sql.Int, userId)
    .input("TrainingId", sql.Int, trainingId)
    .input("Attendance", sql.NVarChar, attendance).query(`
      UPDATE UserTraining
      SET Attendance=@Attendance
      WHERE UserId=@UserId AND TrainingId=@TrainingId
    `);
}

module.exports = {
  hrListTrainings,
  hrCreateTraining,
  ensureUserTrainingRows,
  listEmployeeTrainings,
  updateAttendance,
};
