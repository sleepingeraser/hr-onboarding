const router = require("express").Router();
const { authRequired, roleRequired } = require("../middleware/auth");
const ctrl = require("../controllers/announcementsController");

// anyone logged in
router.get("/announcements", authRequired, ctrl.listAnnouncements);

// HR
router.post(
  "/hr/announcements",
  authRequired,
  roleRequired("HR"),
  ctrl.hrCreateAnnouncement,
);
router.delete(
  "/hr/announcements/:id",
  authRequired,
  roleRequired("HR"),
  ctrl.hrDeleteAnnouncement,
);
router.get(
  "/hr/announcements/all",
  authRequired,
  roleRequired("HR"),
  ctrl.hrListAllAnnouncements,
);

module.exports = router;
