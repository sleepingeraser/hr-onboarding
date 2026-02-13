const { sql, getPool } = require("../config/dbConfig");

async function getEmployees(req, res) {
  try {
    console.log("Getting employees list for HR:", req.user.email);

    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT 
        u.UserId,
        u.Name,
        u.Email,
        u.Role,
        u.CreatedAt,
        (SELECT COUNT(*) FROM UserChecklist WHERE UserId = u.UserId) as ChecklistTotal,
        (SELECT COUNT(*) FROM UserChecklist WHERE UserId = u.UserId AND Status = 'DONE') as ChecklistDone,
        (SELECT COUNT(*) FROM Documents WHERE UserId = u.UserId AND Status = 'PENDING') as PendingDocs,
        (SELECT COUNT(*) FROM UserEquipment WHERE UserId = u.UserId AND ReturnedAt IS NULL) as BorrowingNow,
        (SELECT TOP 1 ItemName FROM UserEquipment ue 
         INNER JOIN Equipment e ON ue.EquipmentId = e.EquipmentId 
         WHERE ue.UserId = u.UserId ORDER BY ue.AssignedAt DESC) as LastItemName,
        (SELECT TOP 1 SerialNumber FROM UserEquipment ue 
         INNER JOIN Equipment e ON ue.EquipmentId = e.EquipmentId 
         WHERE ue.UserId = u.UserId ORDER BY ue.AssignedAt DESC) as LastSerialNumber,
        (SELECT TOP 1 AssignedAt FROM UserEquipment 
         WHERE UserId = u.UserId ORDER BY AssignedAt DESC) as LastAssignedAt,
        (SELECT TOP 1 ReturnedAt FROM UserEquipment 
         WHERE UserId = u.UserId ORDER BY ReturnedAt DESC) as LastReturnedAt,
        (SELECT TOP 1 EmployeeAck FROM UserEquipment 
         WHERE UserId = u.UserId ORDER BY AssignedAt DESC) as LastEmployeeAck
      FROM Users u
      WHERE u.Role = 'EMPLOYEE'
      ORDER BY u.CreatedAt DESC
    `);

    res.json({
      success: true,
      employees: result.recordset,
    });
  } catch (err) {
    console.error("GET employees error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function pingHR(req, res) {
  console.log("HR ping successful for:", req.user.email);
  res.json({
    success: true,
    message: "HR session active",
  });
}

async function pingEmployee(req, res) {
  console.log("Employee ping successful for:", req.user.email);
  res.json({
    success: true,
    message: "Employee session active",
  });
}

module.exports = {
  getEmployees,
  pingHR,
  pingEmployee,
};
