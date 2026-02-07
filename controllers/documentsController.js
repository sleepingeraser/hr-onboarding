const { sql, getPool } = require("../config/dbConfig");

async function getChecklist(req, res) {
  try {
    const p = await getPool();

    await p.request().input("UserId", sql.Int, req.user.userId).query(`
      INSERT INTO UserChecklist (UserId, ItemId)
      SELECT @UserId, c.ItemId
      FROM ChecklistItems c
      WHERE c.IsActive=1
        AND NOT EXISTS (
          SELECT 1 FROM UserChecklist uc
          WHERE uc.UserId=@UserId AND uc.ItemId=c.ItemId
        )
    `);

    const items = await p.request().input("UserId", sql.Int, req.user.userId)
      .query(`
        SELECT c.ItemId, c.Title, c.Stage, c.Description,
               uc.Status, uc.UpdatedAt
        FROM ChecklistItems c
        JOIN UserChecklist uc ON uc.ItemId=c.ItemId AND uc.UserId=@UserId
        WHERE c.IsActive=1
        ORDER BY
          CASE c.Stage WHEN 'DAY1' THEN 1 WHEN 'WEEK1' THEN 2 ELSE 3 END,
          c.ItemId
      `);

    res.json({ items: items.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function updateChecklistItem(req, res) {
  try {
    const itemId = Number(req.params.itemId);
    const { status } = req.body || {};

    if (!itemId) return res.status(400).json({ message: "Invalid itemId" });
    if (!["PENDING", "DONE"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const p = await getPool();
    await p
      .request()
      .input("UserId", sql.Int, req.user.userId)
      .input("ItemId", sql.Int, itemId)
      .input("Status", sql.NVarChar, status).query(`
        UPDATE UserChecklist
        SET Status=@Status, UpdatedAt=SYSDATETIME()
        WHERE UserId=@UserId AND ItemId=@ItemId
      `);

    res.json({ message: "Updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { getChecklist, updateChecklistItem };
