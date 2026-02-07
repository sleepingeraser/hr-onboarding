const { sql, getPool } = require("../config/dbConfig");

async function getChecklist(req, res) {
  try {
    const p = await getPool();
    const rows = await p.request().input("UserId", sql.Int, req.user.userId)
      .query(`
        SELECT ci.ItemId, ci.Title, ci.Description, ci.Stage,
               uc.Status
        FROM ChecklistItems ci
        JOIN UserChecklist uc ON uc.ItemId = ci.ItemId
        WHERE uc.UserId=@UserId
        ORDER BY ci.ItemId ASC
      `);

    res.json({ items: rows.recordset });
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
    if (!["DONE", "PENDING"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

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
