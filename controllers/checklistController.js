const { sql, getPool } = require("../config/dbConfig");

async function getChecklist(req, res) {
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

    res.json({
      success: true,
      items: result.recordset,
    });
  } catch (err) {
    console.error("GET checklist error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function updateChecklistItem(req, res) {
  try {
    const { itemId } = req.params;
    const { status } = req.body;

    if (!["PENDING", "DONE"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be PENDING or DONE",
      });
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

    res.json({
      success: true,
      message: "Checklist updated",
    });
  } catch (err) {
    console.error("PATCH checklist error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = {
  getChecklist,
  updateChecklistItem,
};
