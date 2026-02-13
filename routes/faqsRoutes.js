const express = require("express");
const router = express.Router();
const faqsController = require("../controllers/faqsController");
const { authRequired, hrRequired } = require("../middleware/auth");

// employee routes
router.get("/faqs", authRequired, faqsController.getFAQs);

// HR routes
router.post("/hr/faqs", authRequired, hrRequired, faqsController.createFAQ);
router.patch(
  "/hr/faqs/:faqId",
  authRequired,
  hrRequired,
  faqsController.updateFAQ,
);

module.exports = router;
