const equipmentModel = require("../models/equipmentModel");
const usersModel = require("../models/usersModel");

async function hrCreateEquipment(req, res) {
  try {
    const { itemName, serialNumber, category } = req.body || {};
    if (!itemName) return res.status(400).json({ message: "Missing itemName" });

    await equipmentModel.createEquipment(itemName, serialNumber, category);
    res.status(201).json({ message: "Equipment created" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListEquipment(req, res) {
  try {
    const equipment = await equipmentModel.listEquipment();
    res.json({ equipment });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListEmployees(req, res) {
  try {
    const employees = await usersModel.listEmployeesWithStats();
    res.json({ employees });
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

    if (!uid || !eid)
      return res.status(400).json({ message: "Missing userId/equipmentId" });

    const statusRow = await equipmentModel.getEquipmentStatus(eid);
    if (!statusRow)
      return res.status(404).json({ message: "Equipment not found" });
    if (statusRow.Status !== "AVAILABLE")
      return res.status(409).json({ message: "Equipment not available" });

    await equipmentModel.assignEquipment({
      userId: uid,
      equipmentId: eid,
      dueBackAt,
      notes,
    });
    res.status(201).json({ message: "Assigned" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListAssignments(req, res) {
  try {
    const assignments = await equipmentModel.listAssignments();
    res.json({ assignments });
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

    const row = await equipmentModel.getAssignment(assignmentId);
    if (!row) return res.status(404).json({ message: "Not found" });
    if (row.ReturnedAt)
      return res.status(409).json({ message: "Already returned" });

    await equipmentModel.markReturned(assignmentId, row.EquipmentId);
    res.json({ message: "Returned" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function employeeMyEquipment(req, res) {
  try {
    const equipment = await equipmentModel.listMyEquipment(req.user.userId);
    res.json({ equipment });
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

    await equipmentModel.ackEquipment(req.user.userId, assignmentId);
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
