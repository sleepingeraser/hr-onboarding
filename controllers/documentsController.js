const { sql, getPool } = require("../config/dbConfig");
const path = require("path");
const fs = require("fs");

async function getMyDocuments(req, res) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, req.user.userId).query(`
        SELECT 
          DocId,
          DocType,
          FileUrl,
          Status,
          HRComment,
          UploadedAt
        FROM Documents
        WHERE UserId = @UserId
        ORDER BY UploadedAt DESC
      `);

    res.json({
      success: true,
      documents: result.recordset,
    });
  } catch (err) {
    console.error("GET my documents error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { docType } = req.body;
    if (!docType) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Document type required",
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const pool = await getPool();
    await pool
      .request()
      .input("UserId", sql.Int, req.user.userId)
      .input("DocType", sql.NVarChar(50), docType)
      .input("FileUrl", sql.NVarChar(300), fileUrl).query(`
        INSERT INTO Documents (UserId, DocType, FileUrl, Status)
        VALUES (@UserId, @DocType, @FileUrl, 'PENDING')
      `);

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
    });
  } catch (err) {
    console.error("Upload document error:", err);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function getPendingDocuments(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        d.DocId,
        d.DocType,
        d.FileUrl,
        d.Status,
        d.HRComment,
        d.UploadedAt,
        u.UserId,
        u.Name,
        u.Email
      FROM Documents d
      INNER JOIN Users u ON d.UserId = u.UserId
      WHERE d.Status = 'PENDING'
      ORDER BY d.UploadedAt ASC
    `);

    res.json({
      success: true,
      documents: result.recordset,
    });
  } catch (err) {
    console.error("GET pending docs error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function updateDocumentStatus(req, res) {
  try {
    const { docId } = req.params;
    const { status, comment } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be APPROVED or REJECTED",
      });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("DocId", sql.Int, docId)
      .input("Status", sql.NVarChar(20), status)
      .input("Comment", sql.NVarChar(300), comment || null).query(`
        UPDATE Documents
        SET Status = @Status, HRComment = @Comment
        WHERE DocId = @DocId
      `);

    res.json({
      success: true,
      message: `Document ${status.toLowerCase()}`,
    });
  } catch (err) {
    console.error("PATCH document error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = {
  getMyDocuments,
  uploadDocument,
  getPendingDocuments,
  updateDocumentStatus,
};
