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

// get user's equipment
router.get("/equipment/my", authRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, req.user.userId).query(`
        SELECT 
          ue.AssignmentId,
          e.EquipmentId,
          e.ItemName,
          e.SerialNumber,
          e.Category,
          ue.AssignedAt,
          ue.DueBackAt,
          ue.Notes,
          ue.EmployeeAck,
          ue.ReturnedAt
        FROM UserEquipment ue
        INNER JOIN Equipment e ON ue.EquipmentId = e.EquipmentId
        WHERE ue.UserId = @UserId
        ORDER BY ue.AssignedAt DESC
      `);

    res.json({ equipment: result.recordset });
  } catch (err) {
    console.error("GET my equipment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// acknowledge equipment
router.patch(
  "/equipment/my/:assignmentId/ack",
  authRequired,
  async (req, res) => {
    try {
      const { assignmentId } = req.params;

      const pool = await getPool();
      await pool
        .request()
        .input("AssignmentId", sql.Int, assignmentId)
        .input("UserId", sql.Int, req.user.userId).query(`
        UPDATE UserEquipment
        SET EmployeeAck = 1
        WHERE AssignmentId = @AssignmentId AND UserId = @UserId AND ReturnedAt IS NULL
      `);

      res.json({ message: "Equipment acknowledged" });
    } catch (err) {
      console.error("PATCH ack error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: get all equipment
router.get("/hr/equipment", authRequired, hrRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        EquipmentId,
        ItemName,
        SerialNumber,
        Category,
        Status,
        CreatedAt
      FROM Equipment
      ORDER BY CreatedAt DESC
    `);

    res.json({ equipment: result.recordset });
  } catch (err) {
    console.error("GET equipment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: get all assignments
router.get(
  "/hr/equipment/assignments",
  authRequired,
  hrRequired,
  async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
      SELECT 
        ue.AssignmentId,
        u.Name,
        u.Email,
        e.ItemName,
        e.SerialNumber,
        ue.AssignedAt,
        ue.DueBackAt,
        ue.Notes,
        ue.EmployeeAck,
        ue.ReturnedAt
      FROM UserEquipment ue
      INNER JOIN Users u ON ue.UserId = u.UserId
      INNER JOIN Equipment e ON ue.EquipmentId = e.EquipmentId
      ORDER BY ue.AssignedAt DESC
    `);

      res.json({ assignments: result.recordset });
    } catch (err) {
      console.error("GET assignments error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: create equipment
router.post("/hr/equipment", authRequired, hrRequired, async (req, res) => {
  try {
    const { itemName, serialNumber, category } = req.body;

    if (!itemName) {
      return res.status(400).json({ message: "Item name required" });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("ItemName", sql.NVarChar(120), itemName)
      .input("SerialNumber", sql.NVarChar(120), serialNumber || null)
      .input("Category", sql.NVarChar(50), category || null).query(`
        INSERT INTO Equipment (ItemName, SerialNumber, Category, Status)
        VALUES (@ItemName, @SerialNumber, @Category, 'AVAILABLE')
      `);

    res.status(201).json({ message: "Equipment added" });
  } catch (err) {
    console.error("POST equipment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: assign equipment
router.post(
  "/hr/equipment/assign",
  authRequired,
  hrRequired,
  async (req, res) => {
    try {
      const { userId, equipmentId, dueBackAt, notes } = req.body;

      if (!userId || !equipmentId) {
        return res.status(400).json({ message: "User and equipment required" });
      }

      const pool = await getPool();

      // check if equipment is available
      const checkResult = await pool
        .request()
        .input("EquipmentId", sql.Int, equipmentId)
        .query("SELECT Status FROM Equipment WHERE EquipmentId = @EquipmentId");

      if (checkResult.recordset[0]?.Status !== "AVAILABLE") {
        return res.status(400).json({ message: "Equipment not available" });
      }

      // create assignment
      await pool
        .request()
        .input("UserId", sql.Int, userId)
        .input("EquipmentId", sql.Int, equipmentId)
        .input(
          "DueBackAt",
          sql.DateTime2,
          dueBackAt ? new Date(dueBackAt) : null,
        )
        .input("Notes", sql.NVarChar(250), notes || null).query(`
        INSERT INTO UserEquipment (UserId, EquipmentId, DueBackAt, Notes, EmployeeAck)
        VALUES (@UserId, @EquipmentId, @DueBackAt, @Notes, 0)
      `);

      // update equipment status
      await pool
        .request()
        .input("EquipmentId", sql.Int, equipmentId)
        .query(
          "UPDATE Equipment SET Status = 'ASSIGNED' WHERE EquipmentId = @EquipmentId",
        );

      res.status(201).json({ message: "Equipment assigned" });
    } catch (err) {
      console.error("POST assign error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// HR: mark returned
router.patch(
  "/hr/equipment/assignments/:assignmentId/return",
  authRequired,
  hrRequired,
  async (req, res) => {
    try {
      const { assignmentId } = req.params;

      const pool = await getPool();

      // get equipment ID
      const getResult = await pool
        .request()
        .input("AssignmentId", sql.Int, assignmentId)
        .query(
          "SELECT EquipmentId FROM UserEquipment WHERE AssignmentId = @AssignmentId",
        );

      if (getResult.recordset.length === 0) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      const equipmentId = getResult.recordset[0].EquipmentId;

      // mark returned
      await pool.request().input("AssignmentId", sql.Int, assignmentId).query(`
        UPDATE UserEquipment
        SET ReturnedAt = SYSDATETIME()
        WHERE AssignmentId = @AssignmentId
      `);

      // update equipment status
      await pool
        .request()
        .input("EquipmentId", sql.Int, equipmentId)
        .query(
          "UPDATE Equipment SET Status = 'AVAILABLE' WHERE EquipmentId = @EquipmentId",
        );

      res.json({ message: "Equipment marked returned" });
    } catch (err) {
      console.error("PATCH return error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
