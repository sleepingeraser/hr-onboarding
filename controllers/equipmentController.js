const supabase = require("../config/supabaseConfig");

async function getMyEquipment(req, res) {
  try {
    const { data: equipment, error } = await supabase
      .from("user_equipment")
      .select(
        `
        assignment_id,
        assigned_at,
        due_back_at,
        notes,
        employee_ack,
        returned_at,
        equipment!inner (
          equipment_id,
          item_name,
          serial_number,
          category
        )
      `,
      )
      .eq("user_id", req.user.userId)
      .order("assigned_at", { ascending: false });

    if (error) throw error;

    // transform data
    const formattedEquipment = equipment.map((item) => ({
      AssignmentId: item.assignment_id,
      EquipmentId: item.equipment.equipment_id,
      ItemName: item.equipment.item_name,
      SerialNumber: item.equipment.serial_number,
      Category: item.equipment.category,
      AssignedAt: item.assigned_at,
      DueBackAt: item.due_back_at,
      Notes: item.notes,
      EmployeeAck: item.employee_ack,
      ReturnedAt: item.returned_at,
    }));

    res.json({
      success: true,
      equipment: formattedEquipment,
    });
  } catch (err) {
    console.error("GET my equipment error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function acknowledgeEquipment(req, res) {
  try {
    const { assignmentId } = req.params;

    const { error } = await supabase
      .from("user_equipment")
      .update({ employee_ack: true })
      .eq("assignment_id", assignmentId)
      .eq("user_id", req.user.userId)
      .is("returned_at", null);

    if (error) throw error;

    res.json({
      success: true,
      message: "Equipment acknowledged",
    });
  } catch (err) {
    console.error("PATCH ack error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function getAllEquipment(req, res) {
  try {
    const { data: equipment, error } = await supabase
      .from("equipment")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      equipment: equipment || [],
    });
  } catch (err) {
    console.error("GET equipment error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function getAssignments(req, res) {
  try {
    const { data: assignments, error } = await supabase
      .from("user_equipment")
      .select(
        `
        assignment_id,
        assigned_at,
        due_back_at,
        notes,
        employee_ack,
        returned_at,
        users!inner (
          name,
          email
        ),
        equipment!inner (
          item_name,
          serial_number
        )
      `,
      )
      .order("assigned_at", { ascending: false });

    if (error) throw error;

    // transform data
    const formattedAssignments = assignments.map((a) => ({
      AssignmentId: a.assignment_id,
      Name: a.users.name,
      Email: a.users.email,
      ItemName: a.equipment.item_name,
      SerialNumber: a.equipment.serial_number,
      AssignedAt: a.assigned_at,
      DueBackAt: a.due_back_at,
      Notes: a.notes,
      EmployeeAck: a.employee_ack,
      ReturnedAt: a.returned_at,
    }));

    res.json({
      success: true,
      assignments: formattedAssignments,
    });
  } catch (err) {
    console.error("GET assignments error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function createEquipment(req, res) {
  try {
    const { itemName, serialNumber, category } = req.body;

    if (!itemName) {
      return res.status(400).json({
        success: false,
        message: "Item name required",
      });
    }

    const { error } = await supabase.from("equipment").insert([
      {
        item_name: itemName,
        serial_number: serialNumber || null,
        category: category || null,
        status: "AVAILABLE",
      },
    ]);

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "Equipment added",
    });
  } catch (err) {
    console.error("POST equipment error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function assignEquipment(req, res) {
  try {
    const { userId, equipmentId, dueBackAt, notes } = req.body;

    if (!userId || !equipmentId) {
      return res.status(400).json({
        success: false,
        message: "User and equipment required",
      });
    }

    // check if equipment is available
    const { data: equipment, error: checkError } = await supabase
      .from("equipment")
      .select("status")
      .eq("equipment_id", equipmentId)
      .single();

    if (checkError) throw checkError;

    if (equipment.status !== "AVAILABLE") {
      return res.status(400).json({
        success: false,
        message: "Equipment not available",
      });
    }

    // create assignment
    const { error: assignError } = await supabase
      .from("user_equipment")
      .insert([
        {
          user_id: userId,
          equipment_id: equipmentId,
          due_back_at: dueBackAt ? new Date(dueBackAt).toISOString() : null,
          notes: notes || null,
          employee_ack: false,
        },
      ]);

    if (assignError) throw assignError;

    // update equipment status
    const { error: updateError } = await supabase
      .from("equipment")
      .update({ status: "ASSIGNED" })
      .eq("equipment_id", equipmentId);

    if (updateError) throw updateError;

    res.status(201).json({
      success: true,
      message: "Equipment assigned",
    });
  } catch (err) {
    console.error("POST assign error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function markReturned(req, res) {
  try {
    const { assignmentId } = req.params;

    // get assignment details
    const { data: assignment, error: getError } = await supabase
      .from("user_equipment")
      .select("equipment_id")
      .eq("assignment_id", assignmentId)
      .maybeSingle();

    if (getError || !assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    // mark as returned
    const { error: updateError } = await supabase
      .from("user_equipment")
      .update({ returned_at: new Date().toISOString() })
      .eq("assignment_id", assignmentId);

    if (updateError) throw updateError;

    // update equipment status
    const { error: equipError } = await supabase
      .from("equipment")
      .update({ status: "AVAILABLE" })
      .eq("equipment_id", assignment.equipment_id);

    if (equipError) throw equipError;

    res.json({
      success: true,
      message: "Equipment marked returned",
    });
  } catch (err) {
    console.error("PATCH return error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = {
  getMyEquipment,
  acknowledgeEquipment,
  getAllEquipment,
  getAssignments,
  createEquipment,
  assignEquipment,
  markReturned,
};
