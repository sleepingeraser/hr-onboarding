const express = require("express");
const router = express.Router();
const frappeService = require("../services/frappeApi");
const { authRequired, hrRequired } = require("../middleware/auth");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// get documents
router.get("/frappe/:doctype", authRequired, hrRequired, async (req, res) => {
  try {
    const { doctype } = req.params;
    const { fields, filters, order_by, limit_start, limit_page_length } =
      req.query;

    const options = {
      fields: fields ? JSON.parse(fields) : null,
      filters: filters ? JSON.parse(filters) : null,
      order_by,
      limit_start: limit_start ? parseInt(limit_start) : null,
      limit_page_length: limit_page_length ? parseInt(limit_page_length) : null,
    };

    const result = await frappeService.getDocuments(doctype, options);
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching from Frappe",
      error: error.message,
    });
  }
});

// get single document
router.get(
  "/frappe/:doctype/:name",
  authRequired,
  hrRequired,
  async (req, res) => {
    try {
      const { doctype, name } = req.params;
      const { expand_links } = req.query;

      const result = await frappeService.getDocument(
        doctype,
        name,
        expand_links === "true",
      );
      res.json({ success: true, data: result.data });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching document",
        error: error.message,
      });
    }
  },
);

// create document
router.post("/frappe/:doctype", authRequired, hrRequired, async (req, res) => {
  try {
    const { doctype } = req.params;
    const result = await frappeService.createDocument(doctype, req.body);
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating document in Frappe",
      error: error.message,
    });
  }
});

// update document
router.put(
  "/frappe/:doctype/:name",
  authRequired,
  hrRequired,
  async (req, res) => {
    try {
      const { doctype, name } = req.params;
      const result = await frappeService.updateDocument(
        doctype,
        name,
        req.body,
      );
      res.json({ success: true, data: result.data });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating document in Frappe",
        error: error.message,
      });
    }
  },
);

// delete document
router.delete(
  "/frappe/:doctype/:name",
  authRequired,
  hrRequired,
  async (req, res) => {
    try {
      const { doctype, name } = req.params;
      await frappeService.deleteDocument(doctype, name);
      res.json({ success: true, message: "Document deleted successfully" });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error deleting document from Frappe",
        error: error.message,
      });
    }
  },
);

// call remote method
router.post("/frappe/method/:methodPath(*)", authRequired, async (req, res) => {
  try {
    const { methodPath } = req.params;
    const result = await frappeService.callMethod(methodPath, req.body, "POST");
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error calling Frappe method",
      error: error.message,
    });
  }
});

// upload file to Frappe
router.post(
  "/frappe/upload",
  authRequired,
  upload.single("file"),
  async (req, res) => {
    try {
      const { doctype, docname } = req.body;
      const result = await frappeService.uploadFile(
        req.file.buffer,
        req.file.originalname,
        doctype,
        docname,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error uploading file to Frappe",
        error: error.message,
      });
    }
  },
);

module.exports = router;
