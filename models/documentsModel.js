const { getPool, sql } = require("../config/dbConfig");

async function createDocument(userId, docType, fileUrl) {
  const p = await getPool();
  await p
    .request()
    .input("UserId", sql.Int, userId)
    .input("DocType", sql.NVarChar, docType)
    .input("FileUrl", sql.NVarChar, fileUrl).query(`
      INSERT INTO Documents (UserId, DocType, FileUrl)
      VALUES (@UserId, @DocType, @FileUrl)
    `);
}

async function listMyDocuments(userId) {
  const p = await getPool();
  const docs = await p.request().input("UserId", sql.Int, userId).query(`
    SELECT DocId, DocType, FileUrl, Status, HRComment, UploadedAt
    FROM Documents
    WHERE UserId=@UserId
    ORDER BY UploadedAt DESC
  `);
  return docs.recordset;
}

async function listPendingDocuments() {
  const p = await getPool();
  const docs = await p.request().query(`
    SELECT d.DocId, d.DocType, d.FileUrl, d.Status, d.HRComment, d.UploadedAt,
           u.UserId, u.Name, u.Email
    FROM Documents d
    JOIN Users u ON u.UserId=d.UserId
    WHERE d.Status='PENDING'
    ORDER BY d.UploadedAt ASC
  `);
  return docs.recordset;
}

async function reviewDocument(docId, status, comment) {
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
}

module.exports = {
  createDocument,
  listMyDocuments,
  listPendingDocuments,
  reviewDocument,
};
