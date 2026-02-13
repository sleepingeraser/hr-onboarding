const express = require("express");
const router = express.Router();
const checklistController = require("../controllers/checklistController");
const { authRequired } = require("../middleware/auth");

router.get("/checklist", authRequired, checklistController.getChecklist);
router.patch(
  "/checklist/:itemId",
  authRequired,
  checklistController.updateChecklistItem,
);

module.exports = router;
