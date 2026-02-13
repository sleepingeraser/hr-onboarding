const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const documentsController = require("../controllers/documentsController");
const { authRequired, hrRequired } = require("../middleware/auth");

// ensure uploads directory exists
const uploadDir = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// employee routes
router.get("/documents/my", authRequired, documentsController.getMyDocuments);
router.post(
  "/documents/upload",
  authRequired,
  upload.single("file"),
  documentsController.uploadDocument,
);

// HR routes
router.get(
  "/hr/documents/pending",
  authRequired,
  hrRequired,
  documentsController.getPendingDocuments,
);
router.patch(
  "/hr/documents/:docId",
  authRequired,
  hrRequired,
  documentsController.updateDocumentStatus,
);

module.exports = router;
