const express = require("express");
const router = express.Router();
const announcementsController = require("../controllers/announcementsController");
const { authRequired, hrRequired } = require("../middleware/auth");

// employee routes
router.get(
  "/announcements",
  authRequired,
  announcementsController.getAnnouncements,
);

// HR routes
router.post(
  "/hr/announcements",
  authRequired,
  hrRequired,
  announcementsController.createAnnouncement,
);
router.delete(
  "/hr/announcements/:announcementId",
  authRequired,
  hrRequired,
  announcementsController.deleteAnnouncement,
);

module.exports = router;
