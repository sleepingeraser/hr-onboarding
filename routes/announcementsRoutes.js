const router = require("express").Router();
const { authRequired, roleRequired } = require("../middleware/auth");
const ctrl = require("../controllers/announcementsController");

// employee
router.get("/", authRequired, roleRequired("EMPLOYEE"), ctrl.listAnnouncements);

// HR
router.get("/hr/all", authRequired, roleRequired("HR"), ctrl.hrListAll);
router.post("/hr", authRequired, roleRequired("HR"), ctrl.createAnnouncement);

module.exports = router;
