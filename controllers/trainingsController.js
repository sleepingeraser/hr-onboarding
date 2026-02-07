const { sql, getPool } = require("../config/dbConfig");

async function uploadDocument(req, res) {
  try {
    const { docType } = req.body || {};
    if (!docType) return res.status(400).json({ message: "Missing docType" });
    if (!req.file) return res.status(400).json({ message: "Missing file" });

    const fileUrl = `/uploads/${req.file.filename}`;
    const p = await getPool();

    await p
      .request()
      .input("UserId", sql.Int, req.user.userId)
      .input("DocType", sql.NVarChar, docType)
      .input("FileUrl", sql.NVarChar, fileUrl).query(`
        INSERT INTO Documents (UserId, DocType, FileUrl)
        VALUES (@UserId, @DocType, @FileUrl)
      `);

    res.json({ message: "Uploaded", fileUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function myDocuments(req, res) {
  try {
    const p = await getPool();
    const docs = await p.request().input("UserId", sql.Int, req.user.userId)
      .query(`
        SELECT DocId, DocType, FileUrl, Status, HRComment, UploadedAt
        FROM Documents
        WHERE UserId=@UserId
        ORDER BY UploadedAt DESC
      `);

    res.json({ documents: docs.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function pendingDocuments(req, res) {
  try {
    const p = await getPool();
    const docs = await p.request().query(`
      SELECT d.DocId, d.DocType, d.FileUrl, d.Status, d.HRComment, d.UploadedAt,
             u.UserId, u.Name, u.Email
      FROM Documents d
      JOIN Users u ON u.UserId=d.UserId
      WHERE d.Status='PENDING'
      ORDER BY d.UploadedAt ASC
    `);

    res.json({ documents: docs.recordset });
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

    const p = await getPool();
    await p
      .request()
      .input("DocId", sql.Int, docId)
      .input("Status", sql.NVarChar, status)
      .input("Comment", sql.NVarChar, comment || null).query(`
        UPDATE Documents
        SET Status=@Status, HRComment=@Comment
        WHERE DocId=@DocId
      `);

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
