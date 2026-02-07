const { sql, getPool } = require("../config/dbConfig");

async function hrCreateEquipment(req, res) {
  try {
    const { itemName, serialNumber, category } = req.body || {};
    if (!itemName) return res.status(400).json({ message: "Missing itemName" });

    const p = await getPool();
    await p
      .request()
      .input("ItemName", sql.NVarChar, itemName.trim())
      .input("SerialNumber", sql.NVarChar, serialNumber || null)
      .input("Category", sql.NVarChar, category || null).query(`
        INSERT INTO Equipment (ItemName, SerialNumber, Category)
        VALUES (@ItemName, @SerialNumber, @Category)
      `);

    res.status(201).json({ message: "Equipment created" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListEquipment(req, res) {
  try {
    const p = await getPool();
    const rows = await p.request().query(`
      SELECT EquipmentId, ItemName, SerialNumber, Category, Status, CreatedAt
      FROM Equipment
      ORDER BY CreatedAt DESC
    `);
    res.json({ equipment: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListEmployees(req, res) {
  try {
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

    res.json({ employees: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrAssignEquipment(req, res) {
  try {
    const { userId, equipmentId, dueBackAt, notes } = req.body || {};
    const uid = Number(userId);
    const eid = Number(equipmentId);

    if (!uid || !eid) {
      return res.status(400).json({ message: "Missing userId/equipmentId" });
    }

    const p = await getPool();

    const eq = await p
      .request()
      .input("EquipmentId", sql.Int, eid)
      .query(`SELECT Status FROM Equipment WHERE EquipmentId=@EquipmentId`);

    if (!eq.recordset.length)
      return res.status(404).json({ message: "Equipment not found" });
    if (eq.recordset[0].Status !== "AVAILABLE") {
      return res.status(409).json({ message: "Equipment not available" });
    }

    await p
      .request()
      .input("UserId", sql.Int, uid)
      .input("EquipmentId", sql.Int, eid)
      .input("DueBackAt", sql.DateTime2, dueBackAt ? new Date(dueBackAt) : null)
      .input("Notes", sql.NVarChar, notes || null).query(`
        INSERT INTO UserEquipment (UserId, EquipmentId, DueBackAt, Notes)
        VALUES (@UserId, @EquipmentId, @DueBackAt, @Notes);

        UPDATE Equipment SET Status='ASSIGNED' WHERE EquipmentId=@EquipmentId;
      `);

    res.status(201).json({ message: "Assigned" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListAssignments(req, res) {
  try {
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
    res.json({ assignments: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrMarkReturned(req, res) {
  try {
    const assignmentId = Number(req.params.assignmentId);
    if (!assignmentId)
      return res.status(400).json({ message: "Invalid assignmentId" });

    const p = await getPool();
    const row = await p
      .request()
      .input("AssignmentId", sql.Int, assignmentId)
      .query(
        `SELECT EquipmentId, ReturnedAt FROM UserEquipment WHERE AssignmentId=@AssignmentId`,
      );

    if (!row.recordset.length)
      return res.status(404).json({ message: "Not found" });
    if (row.recordset[0].ReturnedAt)
      return res.status(409).json({ message: "Already returned" });

    const equipmentId = row.recordset[0].EquipmentId;

    await p
      .request()
      .input("AssignmentId", sql.Int, assignmentId)
      .input("EquipmentId", sql.Int, equipmentId).query(`
        UPDATE UserEquipment SET ReturnedAt=SYSDATETIME() WHERE AssignmentId=@AssignmentId;
        UPDATE Equipment SET Status='AVAILABLE' WHERE EquipmentId=@EquipmentId;
      `);

    res.json({ message: "Returned" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function employeeMyEquipment(req, res) {
  try {
    const p = await getPool();
    const rows = await p.request().input("UserId", sql.Int, req.user.userId)
      .query(`
        SELECT ue.AssignmentId, ue.AssignedAt, ue.DueBackAt, ue.Notes, ue.EmployeeAck, ue.ReturnedAt,
               e.ItemName, e.SerialNumber, e.Category
        FROM UserEquipment ue
        JOIN Equipment e ON e.EquipmentId=ue.EquipmentId
        WHERE ue.UserId=@UserId
        ORDER BY ue.AssignedAt DESC
      `);
    res.json({ equipment: rows.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function employeeAckEquipment(req, res) {
  try {
    const assignmentId = Number(req.params.assignmentId);
    if (!assignmentId)
      return res.status(400).json({ message: "Invalid assignmentId" });

    const p = await getPool();
    await p
      .request()
      .input("AssignmentId", sql.Int, assignmentId)
      .input("UserId", sql.Int, req.user.userId).query(`
        UPDATE UserEquipment
        SET EmployeeAck=1
        WHERE AssignmentId=@AssignmentId AND UserId=@UserId
      `);

    res.json({ message: "Acknowledged" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  hrCreateEquipment,
  hrListEquipment,
  hrListEmployees,
  hrAssignEquipment,
  hrListAssignments,
  hrMarkReturned,
  employeeMyEquipment,
  employeeAckEquipment,
};
