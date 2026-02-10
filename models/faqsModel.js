const { getPool, sql } = require("../config/dbConfig");

async function listActiveFaqs() {
  const p = await getPool();
  const rows = await p.request().query(`
    SELECT FaqId, Question, Answer, Category
    FROM FAQs
    WHERE IsActive=1
    ORDER BY Category ASC, CreatedAt DESC
  `);
  return rows.recordset;
}

async function createFaq({ question, answer, category }) {
  const p = await getPool();
  await p
    .request()
    .input("Question", sql.NVarChar, question.trim())
    .input("Answer", sql.NVarChar, answer)
    .input("Category", sql.NVarChar, category || null).query(`
      INSERT INTO FAQs (Question, Answer, Category)
      VALUES (@Question, @Answer, @Category)
    `);
}

async function deactivateFaq(id) {
  const p = await getPool();
  await p
    .request()
    .input("Id", sql.Int, id)
    .query(`UPDATE FAQs SET IsActive=0 WHERE FaqId=@Id`);
}

async function listAllFaqs() {
  const p = await getPool();
  const rows = await p.request().query(`
    SELECT FaqId, Question, Answer, Category, IsActive, CreatedAt
    FROM FAQs
    ORDER BY CreatedAt DESC
  `);
  return rows.recordset;
}

module.exports = {
  listActiveFaqs,
  createFaq,
  deactivateFaq,
  listAllFaqs,
};
