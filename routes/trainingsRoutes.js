const router = require("express").Router();
const { authRequired, roleRequired } = require("../middleware/auth");
const ctrl = require("../controllers/trainingsController");

// employee
router.get(
  "/trainings",
  authRequired,
  roleRequired("EMPLOYEE"),
  ctrl.listTrainings,
);
router.patch(
  "/trainings/:trainingId/attendance",
  authRequired,
  roleRequired("EMPLOYEE"),
  ctrl.updateAttendance,
);

// HR
router.get(
  "/hr/trainings",
  authRequired,
  roleRequired("HR"),
  ctrl.hrListTrainings,
);
router.post(
  "/hr/trainings",
  authRequired,
  roleRequired("HR"),
  ctrl.hrCreateTraining,
);

module.exports = router;
