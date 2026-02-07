const router = require("express").Router();
const { authRequired, roleRequired } = require("../middleware/auth");
const ctrl = require("../controllers/trainingController");

// HR
router.get("/hr", authRequired, roleRequired("HR"), ctrl.listHRTrainings);
router.post("/hr", authRequired, roleRequired("HR"), ctrl.createTraining);

// employee
router.get("/my", authRequired, roleRequired("EMPLOYEE"), ctrl.myTrainings);
router.patch(
  "/my/:trainingId",
  authRequired,
  roleRequired("EMPLOYEE"),
  ctrl.updateAttendance,
);

module.exports = router;
