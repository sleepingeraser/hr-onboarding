const { sql, getPool } = require("../config/dbConfig");

async function listFaqs(req, res) {
  try {
    const p = await getPool();
    const rows = await p.request().query(`
      SELECT TOP 50 FaqId, Question, Answer, Category, CreatedAt
      FROM FAQs
      WHERE IsActive=1
      ORDER BY CreatedAt DESC
    `);
    res.json({ faqs: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListAll(req, res) {
  try {
    const p = await getPool();
    const rows = await p.request().query(`
      SELECT FaqId, Question, Answer, Category, IsActive, CreatedAt
      FROM FAQs
      ORDER BY CreatedAt DESC
    `);
    res.json({ faqs: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function createFaq(req, res) {
  try {
    const { question, answer, category } = req.body || {};
    if (!question || !answer)
      return res.status(400).json({ message: "Missing question/answer" });

    const p = await getPool();
    await p
      .request()
      .input("Question", sql.NVarChar, question.trim())
      .input("Answer", sql.NVarChar, answer)
      .input("Category", sql.NVarChar, category || null).query(`
        INSERT INTO FAQs (Question, Answer, Category)
        VALUES (@Question, @Answer, @Category)
      `);

    res.status(201).json({ message: "FAQ created" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function deactivateFaq(req, res) {
  try {
    const id = Number(req.params.id);
    const p = await getPool();
    await p
      .request()
      .input("Id", sql.Int, id)
      .query(`UPDATE FAQs SET IsActive=0 WHERE FaqId=@Id`);
    res.json({ message: "Deactivated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { listFaqs, hrListAll, createFaq, deactivateFaq };
