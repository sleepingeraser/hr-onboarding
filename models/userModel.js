const supabase = require("../config/supabaseConfig");

class UserModel {
  static tableName = "users";

  static async findById(userId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) return null;
    return data;
  }

  static async findByEmail(email) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) return null;
    return data;
  }

  static async findAll(role = null) {
    let query = supabase
      .from(this.tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (role) {
      query = query.eq("role", role);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  static async findAllEmployees() {
    return await this.findAll("EMPLOYEE");
  }

  static async findAllHR() {
    return await this.findAll("HR");
  }

  static async create(userData) {
    const { name, email, passwordHash, role } = userData;

    const { data, error } = await supabase
      .from(this.tableName)
      .insert([
        {
          name,
          email,
          password_hash: passwordHash,
          role,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async update(userId, userData) {
    const updates = {};
    if (userData.name !== undefined) updates.name = userData.name;
    if (userData.email !== undefined) updates.email = userData.email;
    if (userData.passwordHash !== undefined)
      updates.password_hash = userData.passwordHash;
    if (userData.role !== undefined) updates.role = userData.role;

    if (Object.keys(updates).length === 0) return null;

    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(userId) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq("user_id", userId);

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

  static async countByRole(role) {
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
      .eq("role", role);

    if (error) throw error;
    return count || 0;
  }

  static async getEmployeeSummary() {
    const { data: employees, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("role", "EMPLOYEE")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // get additional stats for each employee
    const employeesWithStats = await Promise.all(
      employees.map(async (employee) => {
        // checklist stats
        const { data: checklist } = await supabase
          .from("user_checklist")
          .select("status")
          .eq("user_id", employee.user_id);

        const checklistTotal = checklist?.length || 0;
        const checklistDone =
          checklist?.filter((item) => item.status === "DONE").length || 0;

        // pending docs
        const { data: pendingDocs } = await supabase
          .from("documents")
          .select("doc_id")
          .eq("user_id", employee.user_id)
          .eq("status", "PENDING");

        // currently borrowing
        const { data: borrowing } = await supabase
          .from("user_equipment")
          .select("assignment_id")
          .eq("user_id", employee.user_id)
          .is("returned_at", null);

        // latest equipment
        const { data: latestEquip } = await supabase
          .from("user_equipment")
          .select(
            `
            assigned_at,
            returned_at,
            employee_ack,
            equipment!inner (
              item_name,
              serial_number
            )
          `,
          )
          .eq("user_id", employee.user_id)
          .order("assigned_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          UserId: employee.user_id,
          Name: employee.name,
          Email: employee.email,
          Role: employee.role,
          CreatedAt: employee.created_at,
          ChecklistTotal: checklistTotal,
          ChecklistDone: checklistDone,
          PendingDocs: pendingDocs?.length || 0,
          BorrowingNow: borrowing?.length || 0,
          LastItemName: latestEquip?.equipment?.item_name || null,
          LastSerialNumber: latestEquip?.equipment?.serial_number || null,
          LastAssignedAt: latestEquip?.assigned_at || null,
          LastReturnedAt: latestEquip?.returned_at || null,
          LastEmployeeAck: latestEquip?.employee_ack || false,
        };
      }),
    );

    return employeesWithStats;
  }
}

module.exports = UserModel;
