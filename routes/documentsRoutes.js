const router = require("express").Router();
const { authRequired, roleRequired } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const ctrl = require("../controllers/documentsController");

// employee
router.post(
  "/upload",
  authRequired,
  roleRequired("EMPLOYEE"),
  upload.single("file"),
  ctrl.uploadDocument,
);
router.get("/my", authRequired, roleRequired("EMPLOYEE"), ctrl.myDocuments);

// HR
router.get(
  "/hr/pending",
  authRequired,
  roleRequired("HR"),
  ctrl.pendingDocuments,
);
router.patch(
  "/hr/:docId/review",
  authRequired,
  roleRequired("HR"),
  ctrl.reviewDocument,
);

module.exports = router;
