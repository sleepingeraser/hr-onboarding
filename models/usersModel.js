const frappe = require("../services/frappeClient");

class UsersModel {
  async findByEmail(email) {
    try {
      const response = await frappe.getDoc("User", email.toLowerCase());
      return {
        UserId: response.data.name,
        Name: response.data.full_name || response.data.first_name,
        Email: response.data.email,
        Role: response.data.roles?.some((r) => r.role === "HR Manager")
          ? "HR"
          : "EMPLOYEE",
      };
    } catch {
      return null;
    }
  }

  async createUser({ name, email, passwordHash, role }) {
    // This is handled in authService.register
    throw new Error("Use authService.register instead");
  }

  async listEmployeesWithStats() {
    try {
      const response = await frappe.listDocType("Employee", {
        fields: JSON.stringify([
          "name",
          "employee_name",
          "user_id",
          "date_of_joining",
          "status",
          "designation",
          "department",
        ]),
        filters: JSON.stringify([["status", "=", "Active"]]),
        order_by: "employee_name asc",
      });

      const employees = [];

      for (const emp of response.data) {
        // Get checklist stats
        const checklist = await frappe.listDocType("Employee Checklist", {
          filters: JSON.stringify([["employee", "=", emp.name]]),
        });

        const totalItems = checklist.data.length;
        const completedItems = checklist.data.filter(
          (i) => i.status === "Completed",
        ).length;

        // Get document stats
        const docs = await frappe.listDocType("Employee Document", {
          filters: JSON.stringify([["employee", "=", emp.name]]),
        });

        const pendingDocs = docs.data.filter(
          (d) => d.status === "Pending",
        ).length;

        // Get equipment stats
        const equipment = await frappe.listDocType("Asset Movement", {
          filters: JSON.stringify([
            ["employee", "=", emp.name],
            ["docstatus", "=", 1],
            ["actual_return_date", "=", null],
          ]),
        });

        const borrowingNow = equipment.data.length;

        // Get latest equipment
        const latestEq = equipment.data[0] || null;
        let lastItemName = null,
          lastSerialNumber = null,
          lastAssignedAt = null,
          lastReturnedAt = null,
          lastEmployeeAck = null;

        if (latestEq) {
          const asset = await frappe.getDoc("Asset", latestEq.asset);
          lastItemName = asset.data.asset_name;
          lastSerialNumber = asset.data.serial_no;
          lastAssignedAt = latestEq.movement_date;
          lastReturnedAt = latestEq.actual_return_date;
          lastEmployeeAck = latestEq.actual_return_date ? 1 : 0;
        }

        employees.push({
          UserId: emp.user_id,
          Name: emp.employee_name,
          Email: emp.user_id,
          CreatedAt: emp.date_of_joining,
          ChecklistTotal: totalItems,
          ChecklistDone: completedItems,
          PendingDocs: pendingDocs,
          BorrowingNow: borrowingNow,
          LastItemName: lastItemName,
          LastSerialNumber: lastSerialNumber,
          LastAssignedAt: lastAssignedAt,
          LastReturnedAt: lastReturnedAt,
          LastEmployeeAck: lastEmployeeAck,
        });
      }

      return employees;
    } catch (error) {
      console.error("Error listing employees:", error);
      return [];
    }
  }
}

module.exports = new UsersModel();
