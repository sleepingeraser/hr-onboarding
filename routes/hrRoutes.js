const express = require("express");
const router = express.Router();
const hrController = require("../controllers/hrController");
const { authRequired, hrRequired } = require("../middleware/auth");

router.get(
  "/hr/employees",
  authRequired,
  hrRequired,
  hrController.getEmployees,
);
router.get("/hr/ping", authRequired, hrRequired, hrController.pingHR);
router.get("/employee/ping", authRequired, hrController.pingEmployee);

module.exports = router;
