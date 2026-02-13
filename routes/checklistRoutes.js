const express = require("express");
const router = express.Router();
const { sql, getPool } = require("../config/dbConfig");

// auth middleware
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

// get user's checklist
router.get("/checklist", authRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, req.user.userId).query(`
        SELECT 
          ci.ItemId,
          ci.Title,
          ci.Stage,
          ci.Description,
          uc.Status,
          uc.UpdatedAt
        FROM ChecklistItems ci
        INNER JOIN UserChecklist uc ON ci.ItemId = uc.ItemId
        WHERE uc.UserId = @UserId AND ci.IsActive = 1
        ORDER BY 
          CASE ci.Stage
            WHEN 'DAY1' THEN 1
            WHEN 'WEEK1' THEN 2
            WHEN 'MONTH1' THEN 3
          END
      `);

    res.json({ items: result.recordset });
  } catch (err) {
    console.error("GET checklist error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// update checklist item status
router.patch("/checklist/:itemId", authRequired, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status } = req.body;

    if (!["PENDING", "DONE"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Status must be PENDING or DONE" });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("UserId", sql.Int, req.user.userId)
      .input("ItemId", sql.Int, itemId)
      .input("Status", sql.NVarChar(20), status).query(`
        UPDATE UserChecklist 
        SET Status = @Status, UpdatedAt = SYSDATETIME()
        WHERE UserId = @UserId AND ItemId = @ItemId
      `);

    res.json({ message: "Checklist updated" });
  } catch (err) {
    console.error("PATCH checklist error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
