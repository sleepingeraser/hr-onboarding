const path = require("path");
const fs = require("fs");
const multer = require("multer");

// absolute path to /public/uploads
const uploadDir = path.join(__dirname, "..", "public", "uploads");

// ensure folder exists (fix ENOENT)
function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}
ensureUploadDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      ensureUploadDir();
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const safeOriginal = String(file.originalname || "file").replace(
      /[^\w.\-]/g,
      "_",
    ); // keep letters/numbers/._-
    const name = `${Date.now()}-${safeOriginal}`;
    cb(null, name);
  },
});

const allowedExt = new Set([".png", ".jpg", ".jpeg", ".pdf", ".doc", ".docx"]);

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!allowedExt.has(ext)) {
    return cb(
      new Error("Invalid file type. Allowed: png, jpg, jpeg, pdf, doc, docx"),
      false,
    );
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // ✅ 10MB
  },
});

module.exports = { upload };
