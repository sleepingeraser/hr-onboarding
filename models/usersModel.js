const { getPool, sql } = require("../config/dbConfig");

async function findByEmail(email) {
  const p = await getPool();
  const result = await p.request().input("Email", sql.NVarChar, email).query(`
      SELECT UserId, Name, Email, PasswordHash, Role
      FROM Users
      WHERE Email=@Email
    `);

  return result.recordset[0] || null;
}

async function createUser({ name, email, passwordHash, role }) {
  const p = await getPool();
  await p
    .request()
    .input("Name", sql.NVarChar, String(name).trim())
    .input("Email", sql.NVarChar, email)
    .input("PasswordHash", sql.NVarChar, passwordHash)
    .input("Role", sql.NVarChar, role).query(`
      INSERT INTO Users (Name, Email, PasswordHash, Role)
      VALUES (@Name, @Email, @PasswordHash, @Role)
    `);
}

async function listEmployeesWithStats() {
  const p = await getPool();
  const rows = await p.request().query(`
    SELECT
      u.UserId,
      u.Name,
      u.Email,
      u.CreatedAt,

      (SELECT COUNT(*) FROM UserChecklist uc WHERE uc.UserId = u.UserId) AS ChecklistTotal,
      (SELECT COUNT(*) FROM UserChecklist uc WHERE uc.UserId = u.UserId AND uc.Status='DONE') AS ChecklistDone,

      (SELECT COUNT(*) FROM Documents d WHERE d.UserId = u.UserId AND d.Status='PENDING') AS PendingDocs,

      (SELECT COUNT(*) FROM UserEquipment ue WHERE ue.UserId = u.UserId AND ue.ReturnedAt IS NULL) AS BorrowingNow,

      lastEq.ItemName AS LastItemName,
      lastEq.SerialNumber AS LastSerialNumber,
      lastEq.AssignedAt AS LastAssignedAt,
      lastEq.ReturnedAt AS LastReturnedAt,
      lastEq.EmployeeAck AS LastEmployeeAck

    FROM Users u
    OUTER APPLY (
      SELECT TOP 1
        e.ItemName,
        e.SerialNumber,
        ue.AssignedAt,
        ue.ReturnedAt,
        ue.EmployeeAck
      FROM UserEquipment ue
      JOIN Equipment e ON e.EquipmentId = ue.EquipmentId
      WHERE ue.UserId = u.UserId
      ORDER BY ue.AssignedAt DESC
    ) lastEq
    WHERE u.Role='EMPLOYEE'
    ORDER BY u.Name ASC
  `);

  return rows.recordset;
}

module.exports = {
  findByEmail,
  createUser,
  listEmployeesWithStats,
};
