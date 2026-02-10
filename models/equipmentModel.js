const { getPool, sql } = require("../config/dbConfig");

async function createEquipment(itemName, serialNumber, category) {
  const p = await getPool();
  await p
    .request()
    .input("ItemName", sql.NVarChar, itemName.trim())
    .input("SerialNumber", sql.NVarChar, serialNumber || null)
    .input("Category", sql.NVarChar, category || null).query(`
      INSERT INTO Equipment (ItemName, SerialNumber, Category)
      VALUES (@ItemName, @SerialNumber, @Category)
    `);
}

async function listEquipment() {
  const p = await getPool();
  const rows = await p.request().query(`
    SELECT EquipmentId, ItemName, SerialNumber, Category, Status, CreatedAt
    FROM Equipment
    ORDER BY CreatedAt DESC
  `);
  return rows.recordset;
}

async function getEquipmentStatus(equipmentId) {
  const p = await getPool();
  const row = await p
    .request()
    .input("EquipmentId", sql.Int, equipmentId)
    .query(`SELECT Status FROM Equipment WHERE EquipmentId=@EquipmentId`);
  return row.recordset[0] || null;
}

async function assignEquipment({ userId, equipmentId, dueBackAt, notes }) {
  const p = await getPool();

  await p
    .request()
    .input("UserId", sql.Int, userId)
    .input("EquipmentId", sql.Int, equipmentId)
    .input("DueBackAt", sql.DateTime2, dueBackAt ? new Date(dueBackAt) : null)
    .input("Notes", sql.NVarChar, notes || null).query(`
      INSERT INTO UserEquipment (UserId, EquipmentId, DueBackAt, Notes)
      VALUES (@UserId, @EquipmentId, @DueBackAt, @Notes);

      UPDATE Equipment SET Status='ASSIGNED' WHERE EquipmentId=@EquipmentId;
    `);
}

async function listAssignments() {
  const p = await getPool();
  const rows = await p.request().query(`
    SELECT ue.AssignmentId, ue.AssignedAt, ue.DueBackAt, ue.Notes, ue.EmployeeAck, ue.ReturnedAt,
           u.UserId, u.Name, u.Email,
           e.EquipmentId, e.ItemName, e.SerialNumber, e.Category
    FROM UserEquipment ue
    JOIN Users u ON u.UserId=ue.UserId
    JOIN Equipment e ON e.EquipmentId=ue.EquipmentId
    ORDER BY ue.AssignedAt DESC
  `);
  return rows.recordset;
}

async function getAssignment(assignmentId) {
  const p = await getPool();
  const row = await p
    .request()
    .input("AssignmentId", sql.Int, assignmentId)
    .query(
      `SELECT EquipmentId, ReturnedAt FROM UserEquipment WHERE AssignmentId=@AssignmentId`,
    );
  return row.recordset[0] || null;
}

async function markReturned(assignmentId, equipmentId) {
  const p = await getPool();
  await p
    .request()
    .input("AssignmentId", sql.Int, assignmentId)
    .input("EquipmentId", sql.Int, equipmentId).query(`
      UPDATE UserEquipment SET ReturnedAt=SYSDATETIME() WHERE AssignmentId=@AssignmentId;
      UPDATE Equipment SET Status='AVAILABLE' WHERE EquipmentId=@EquipmentId;
    `);
}

async function listMyEquipment(userId) {
  const p = await getPool();
  const rows = await p.request().input("UserId", sql.Int, userId).query(`
    SELECT ue.AssignmentId, ue.AssignedAt, ue.DueBackAt, ue.Notes, ue.EmployeeAck, ue.ReturnedAt,
           e.ItemName, e.SerialNumber, e.Category
    FROM UserEquipment ue
    JOIN Equipment e ON e.EquipmentId=ue.EquipmentId
    WHERE ue.UserId=@UserId
    ORDER BY ue.AssignedAt DESC
  `);
  return rows.recordset;
}

async function ackEquipment(userId, assignmentId) {
  const p = await getPool();
  await p
    .request()
    .input("AssignmentId", sql.Int, assignmentId)
    .input("UserId", sql.Int, userId).query(`
      UPDATE UserEquipment
      SET EmployeeAck=1
      WHERE AssignmentId=@AssignmentId AND UserId=@UserId
    `);
}

module.exports = {
  createEquipment,
  listEquipment,
  getEquipmentStatus,
  assignEquipment,
  listAssignments,
  getAssignment,
  markReturned,
  listMyEquipment,
  ackEquipment,
};
