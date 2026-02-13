const { sql, getPool } = require("../config/dbConfig");

async function getFAQs(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT 
          FaqId,
          Question,
          Answer,
          Category,
          IsActive,
          CreatedAt
        FROM FAQs
        WHERE IsActive = 1
        ORDER BY Category, CreatedAt DESC
      `);

    res.json({
      success: true,
      faqs: result.recordset,
    });
  } catch (err) {
    console.error("GET FAQs error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function createFAQ(req, res) {
  try {
    const { question, answer, category } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: "Question and answer required",
      });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("Question", sql.NVarChar(200), question)
      .input("Answer", sql.NVarChar(sql.MAX), answer)
      .input("Category", sql.NVarChar(80), category || null).query(`
        INSERT INTO FAQs (Question, Answer, Category, IsActive)
        VALUES (@Question, @Answer, @Category, 1)
      `);

    res.status(201).json({
      success: true,
      message: "FAQ created",
    });
  } catch (err) {
    console.error("POST FAQ error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function updateFAQ(req, res) {
  try {
    const { faqId } = req.params;
    const { question, answer, category, isActive } = req.body;

    const pool = await getPool();
    const request = pool.request().input("FaqId", sql.Int, faqId);

    let query = "UPDATE FAQs SET ";
    const updates = [];

    if (question !== undefined) {
      request.input("Question", sql.NVarChar(200), question);
      updates.push("Question = @Question");
    }
    if (answer !== undefined) {
      request.input("Answer", sql.NVarChar(sql.MAX), answer);
      updates.push("Answer = @Answer");
    }
    if (category !== undefined) {
      request.input("Category", sql.NVarChar(80), category);
      updates.push("Category = @Category");
    }
    if (isActive !== undefined) {
      request.input("IsActive", sql.Bit, isActive);
      updates.push("IsActive = @IsActive");
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    query += updates.join(", ") + " WHERE FaqId = @FaqId";
    await request.query(query);

    res.json({
      success: true,
      message: "FAQ updated",
    });
  } catch (err) {
    console.error("PATCH FAQ error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = {
  getFAQs,
  createFAQ,
  updateFAQ,
};
