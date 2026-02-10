const trainingsModel = require("../models/trainingsModel");

async function listTrainings(req, res) {
  try {
    await trainingsModel.ensureUserTrainingRows(req.user.userId);
    const trainings = await trainingsModel.listEmployeeTrainings(
      req.user.userId,
    );
    res.json({ trainings });
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
    if (!["UPCOMING", "ATTENDED"].includes(attendance)) {
      return res.status(400).json({ message: "Invalid attendance" });
    }

    await trainingsModel.updateAttendance(
      req.user.userId,
      trainingId,
      attendance,
    );
    res.json({ message: "Updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListTrainings(req, res) {
  try {
    const trainings = await trainingsModel.hrListTrainings(50);
    res.json({ trainings });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrCreateTraining(req, res) {
  try {
    const { title, startsAt, location, notes } = req.body || {};
    if (!title || !startsAt)
      return res.status(400).json({ message: "Missing title/startsAt" });

    await trainingsModel.hrCreateTraining({ title, startsAt, location, notes });
    res.status(201).json({ message: "Training created" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  listTrainings,
  updateAttendance,
  hrListTrainings,
  hrCreateTraining,
};
