const express = require("express");
const router = express.Router();

const { authRequired, roleRequired } = require("../middleware/auth");
const faqsController = require("../controllers/faqsController");

router.get("/faqs", authRequired, faqsController.listFaqs);

router.get(
  "/hr/faqs/all",
  authRequired,
  roleRequired("HR"),
  faqsController.hrListAllFaqs,
);

router.post(
  "/hr/faqs",
  authRequired,
  roleRequired("HR"),
  faqsController.hrCreateFaq,
);

router.patch(
  "/hr/faqs/:id/deactivate",
  authRequired,
  roleRequired("HR"),
  faqsController.hrDeactivateFaq,
);

module.exports = router;
