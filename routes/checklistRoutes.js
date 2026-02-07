const router = require("express").Router();
const { authRequired, roleRequired } = require("../middleware/auth");
const ctrl = require("../controllers/checklistController");

router.get("/", authRequired, roleRequired("EMPLOYEE"), ctrl.getChecklist);
router.patch(
  "/:itemId",
  authRequired,
  roleRequired("EMPLOYEE"),
  ctrl.updateChecklistItem,
);

module.exports = router;
