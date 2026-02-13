const express = require("express");
const router = express.Router();
const trainingController = require("../controllers/trainingController");
const { authRequired, hrRequired } = require("../middleware/auth");

// employee routes
router.get("/trainings", authRequired, trainingController.getTrainings);
router.patch(
  "/trainings/:trainingId/attendance",
  authRequired,
  trainingController.updateAttendance,
);

// HR routes
router.post(
  "/hr/trainings",
  authRequired,
  hrRequired,
  trainingController.createTraining,
);

module.exports = router;
