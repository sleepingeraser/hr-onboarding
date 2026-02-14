const supabase = require("../config/supabaseConfig");

class EquipmentModel {
  static tableName = "equipment";
  static assignmentTableName = "user_equipment";

  // equipment methods
  static async findAll() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async findById(equipmentId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("equipment_id", equipmentId)
      .single();

    if (error) return null;
    return data;
  }

  static async findAvailable() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("status", "AVAILABLE")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async findByStatus(status) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async create(equipmentData) {
    const { itemName, serialNumber, category } = equipmentData;

    const { data, error } = await supabase
      .from(this.tableName)
      .insert([
        {
          item_name: itemName,
          serial_number: serialNumber || null,
          category: category || null,
          status: "AVAILABLE",
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async update(equipmentId, equipmentData) {
    const updates = {};
    if (equipmentData.itemName !== undefined)
      updates.item_name = equipmentData.itemName;
    if (equipmentData.serialNumber !== undefined)
      updates.serial_number = equipmentData.serialNumber;
    if (equipmentData.category !== undefined)
      updates.category = equipmentData.category;
    if (equipmentData.status !== undefined)
      updates.status = equipmentData.status;

    if (Object.keys(updates).length === 0) return null;

    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq("equipment_id", equipmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateStatus(equipmentId, status) {
    return await this.update(equipmentId, { status });
  }

  static async delete(equipmentId) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq("equipment_id", equipmentId);

    if (error) throw error;
    return true;
  }

  static async count() {
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return count || 0;
  }

  static async countByStatus(status) {
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
      .eq("status", status);

    if (error) throw error;
    return count || 0;
  }

  // assignment methods
  static async getAssignments() {
    const { data, error } = await supabase
      .from(this.assignmentTableName)
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
    return (data || []).map((a) => ({
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
  }

  static async getUserEquipment(userId) {
    const { data, error } = await supabase
      .from(this.assignmentTableName)
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
      .eq("user_id", userId)
      .order("assigned_at", { ascending: false });

    if (error) throw error;

    // transform data
    return (data || []).map((item) => ({
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
  }

  static async getCurrentUserEquipment(userId) {
    const equipment = await this.getUserEquipment(userId);
    return equipment.filter((e) => !e.ReturnedAt);
  }

  static async getAssignmentById(assignmentId) {
    const { data, error } = await supabase
      .from(this.assignmentTableName)
      .select("*")
      .eq("assignment_id", assignmentId)
      .single();

    if (error) return null;
    return data;
  }

  static async assign(assignmentData) {
    const { userId, equipmentId, dueBackAt, notes } = assignmentData;

    const { data, error } = await supabase
      .from(this.assignmentTableName)
      .insert([
        {
          user_id: userId,
          equipment_id: equipmentId,
          due_back_at: dueBackAt ? new Date(dueBackAt).toISOString() : null,
          notes: notes || null,
          employee_ack: false,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // update equipment status
    await this.updateStatus(equipmentId, "ASSIGNED");

    return data;
  }

  static async acknowledge(assignmentId, userId) {
    const { error } = await supabase
      .from(this.assignmentTableName)
      .update({ employee_ack: true })
      .eq("assignment_id", assignmentId)
      .eq("user_id", userId)
      .is("returned_at", null);

    if (error) throw error;
  }

  static async markReturned(assignmentId) {
    // get the assignment first
    const assignment = await this.getAssignmentById(assignmentId);
    if (!assignment) return null;

    // mark as returned
    const { error: updateError } = await supabase
      .from(this.assignmentTableName)
      .update({ returned_at: new Date().toISOString() })
      .eq("assignment_id", assignmentId);

    if (updateError) throw updateError;

    // update equipment status
    await this.updateStatus(assignment.equipment_id, "AVAILABLE");

    return assignment;
  }

  static async countActiveAssignments() {
    const { count, error } = await supabase
      .from(this.assignmentTableName)
      .select("*", { count: "exact", head: true })
      .is("returned_at", null);

    if (error) throw error;
    return count || 0;
  }

  static async countUserActiveAssignments(userId) {
    const { count, error } = await supabase
      .from(this.assignmentTableName)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("returned_at", null);

    if (error) throw error;
    return count || 0;
  }

  static async countUnacknowledged(userId) {
    const { count, error } = await supabase
      .from(this.assignmentTableName)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("returned_at", null)
      .eq("employee_ack", false);

    if (error) throw error;
    return count || 0;
  }
}

module.exports = EquipmentModel;
