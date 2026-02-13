const express = require("express");
const router = express.Router();
const { sql, getPool } = require("../config/dbConfig");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  try {
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function hrRequired(req, res, next) {
  if (req.user.role !== "HR") {
    return res.status(403).json({ message: "HR access required" });
  }
  next();
}

// Get FAQs
router.get("/faqs", authRequired, async (req, res) => {
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

    res.json({ faqs: result.recordset });
  } catch (err) {
    console.error("GET FAQs error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: Create FAQ
router.post("/hr/faqs", authRequired, hrRequired, async (req, res) => {
  try {
    const { question, answer, category } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ message: "Question and answer required" });
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

    res.status(201).json({ message: "FAQ created" });
  } catch (err) {
    console.error("POST FAQ error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: Update FAQ
router.patch("/hr/faqs/:faqId", authRequired, hrRequired, async (req, res) => {
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
      return res.status(400).json({ message: "No fields to update" });
    }

    query += updates.join(", ") + " WHERE FaqId = @FaqId";
    await request.query(query);

    res.json({ message: "FAQ updated" });
  } catch (err) {
    console.error("PATCH FAQ error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
