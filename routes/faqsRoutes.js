const router = require("express").Router();
const { authRequired, roleRequired } = require("../middleware/auth");
const ctrl = require("../controllers/faqsController");

// anyone logged in
router.get("/faqs", authRequired, ctrl.listFaqs);

// HR
router.post("/hr/faqs", authRequired, roleRequired("HR"), ctrl.hrCreateFaq);
router.patch(
  "/hr/faqs/:id/deactivate",
  authRequired,
  roleRequired("HR"),
  ctrl.hrDeactivateFaq,
);
router.get(
  "/hr/faqs/all",
  authRequired,
  roleRequired("HR"),
  ctrl.hrListAllFaqs,
);

module.exports = router;
