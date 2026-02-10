const { getPool, sql } = require("../config/dbConfig");

async function ensureUserChecklist(userId) {
  const p = await getPool();
  await p.request().input("UserId", sql.Int, userId).query(`
    INSERT INTO UserChecklist (UserId, ItemId)
    SELECT @UserId, c.ItemId
    FROM ChecklistItems c
    WHERE c.IsActive=1
      AND NOT EXISTS (
        SELECT 1 FROM UserChecklist uc
        WHERE uc.UserId=@UserId AND uc.ItemId=c.ItemId
      )
  `);
}

async function getUserChecklist(userId) {
  const p = await getPool();
  const items = await p.request().input("UserId", sql.Int, userId).query(`
    SELECT c.ItemId, c.Title, c.Stage, c.Description,
           uc.Status, uc.UpdatedAt
    FROM ChecklistItems c
    JOIN UserChecklist uc ON uc.ItemId=c.ItemId AND uc.UserId=@UserId
    WHERE c.IsActive=1
    ORDER BY
      CASE c.Stage WHEN 'DAY1' THEN 1 WHEN 'WEEK1' THEN 2 ELSE 3 END,
      c.ItemId
  `);

  return items.recordset;
}

async function updateChecklistStatus(userId, itemId, status) {
  const p = await getPool();
  await p
    .request()
    .input("UserId", sql.Int, userId)
    .input("ItemId", sql.Int, itemId)
    .input("Status", sql.NVarChar, status).query(`
      UPDATE UserChecklist
      SET Status=@Status, UpdatedAt=SYSDATETIME()
      WHERE UserId=@UserId AND ItemId=@ItemId
    `);
}

module.exports = {
  ensureUserChecklist,
  getUserChecklist,
  updateChecklistStatus,
};
