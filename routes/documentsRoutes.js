const router = require("express").Router();
const { authRequired, roleRequired } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const ctrl = require("../controllers/documentsController");

// employee
router.post(
  "/documents/upload",
  authRequired,
  roleRequired("EMPLOYEE"),
  upload.single("file"),
  ctrl.uploadDocument,
);
router.get(
  "/documents/my",
  authRequired,
  roleRequired("EMPLOYEE"),
  ctrl.myDocuments,
);

// HR
router.get(
  "/hr/documents/pending",
  authRequired,
  roleRequired("HR"),
  ctrl.pendingDocuments,
);
router.patch(
  "/hr/documents/:docId",
  authRequired,
  roleRequired("HR"),
  ctrl.reviewDocument,
);

module.exports = router;
