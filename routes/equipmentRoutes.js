const router = require("express").Router();
const { authRequired, roleRequired } = require("../middleware/auth");
const ctrl = require("../controllers/equipmentController");

// HR
router.post("/hr", authRequired, roleRequired("HR"), ctrl.createEquipment);
router.get("/hr", authRequired, roleRequired("HR"), ctrl.listEquipment);
router.get(
  "/hr/employees",
  authRequired,
  roleRequired("HR"),
  ctrl.listEmployees,
);
router.post(
  "/hr/assign",
  authRequired,
  roleRequired("HR"),
  ctrl.assignEquipment,
);
router.get(
  "/hr/assignments",
  authRequired,
  roleRequired("HR"),
  ctrl.listAssignments,
);
router.patch(
  "/hr/assignments/:assignmentId/return",
  authRequired,
  roleRequired("HR"),
  ctrl.markReturned,
);

// employee
router.get("/my", authRequired, roleRequired("EMPLOYEE"), ctrl.myEquipment);
router.patch(
  "/my/:assignmentId/ack",
  authRequired,
  roleRequired("EMPLOYEE"),
  ctrl.ackEquipment,
);

module.exports = router;
