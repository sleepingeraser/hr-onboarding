const express = require("express");
const router = express.Router();
const equipmentController = require("../controllers/equipmentController");
const { authRequired, hrRequired } = require("../middleware/auth");

// employee routes
router.get("/equipment/my", authRequired, equipmentController.getMyEquipment);
router.patch(
  "/equipment/my/:assignmentId/ack",
  authRequired,
  equipmentController.acknowledgeEquipment,
);

// HR routes
router.get(
  "/hr/equipment",
  authRequired,
  hrRequired,
  equipmentController.getAllEquipment,
);
router.get(
  "/hr/equipment/assignments",
  authRequired,
  hrRequired,
  equipmentController.getAssignments,
);
router.post(
  "/hr/equipment",
  authRequired,
  hrRequired,
  equipmentController.createEquipment,
);
router.post(
  "/hr/equipment/assign",
  authRequired,
  hrRequired,
  equipmentController.assignEquipment,
);
router.patch(
  "/hr/equipment/assignments/:assignmentId/return",
  authRequired,
  hrRequired,
  equipmentController.markReturned,
);

module.exports = router;
