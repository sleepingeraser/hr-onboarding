const router = require("express").Router();
const { authRequired, roleRequired } = require("../middleware/auth");
const ctrl = require("../controllers/equipmentController");

// HR
router.post(
  "/hr/equipment",
  authRequired,
  roleRequired("HR"),
  ctrl.hrCreateEquipment,
);
router.get(
  "/hr/equipment",
  authRequired,
  roleRequired("HR"),
  ctrl.hrListEquipment,
);
router.get(
  "/hr/employees",
  authRequired,
  roleRequired("HR"),
  ctrl.hrListEmployees,
);
router.post(
  "/hr/equipment/assign",
  authRequired,
  roleRequired("HR"),
  ctrl.hrAssignEquipment,
);
router.get(
  "/hr/equipment/assignments",
  authRequired,
  roleRequired("HR"),
  ctrl.hrListAssignments,
);
router.patch(
  "/hr/equipment/assignments/:assignmentId/return",
  authRequired,
  roleRequired("HR"),
  ctrl.hrMarkReturned,
);

// employee
router.get(
  "/equipment/my",
  authRequired,
  roleRequired("EMPLOYEE"),
  ctrl.employeeMyEquipment,
);
router.patch(
  "/equipment/my/:assignmentId/ack",
  authRequired,
  roleRequired("EMPLOYEE"),
  ctrl.employeeAckEquipment,
);

module.exports = router;
