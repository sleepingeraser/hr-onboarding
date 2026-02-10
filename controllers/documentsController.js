const documentsModel = require("../models/documentsModel");

async function uploadDocument(req, res) {
  try {
    const { docType } = req.body || {};
    if (!docType) return res.status(400).json({ message: "Missing docType" });
    if (!req.file) return res.status(400).json({ message: "Missing file" });

    const fileUrl = `/uploads/${req.file.filename}`;
    await documentsModel.createDocument(req.user.userId, docType, fileUrl);

    res.json({ message: "Uploaded", fileUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function myDocuments(req, res) {
  try {
    const documents = await documentsModel.listMyDocuments(req.user.userId);
    res.json({ documents });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function pendingDocuments(req, res) {
  try {
    const documents = await documentsModel.listPendingDocuments();
    res.json({ documents });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function reviewDocument(req, res) {
  try {
    const docId = Number(req.params.docId);
    const { status, comment } = req.body || {};

    if (!docId) return res.status(400).json({ message: "Invalid docId" });
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    await documentsModel.reviewDocument(docId, status, comment);
    res.json({ message: "Updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  uploadDocument,
  myDocuments,
  pendingDocuments,
  reviewDocument,
};
