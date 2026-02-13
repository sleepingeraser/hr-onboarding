const frappe = require("../services/frappeClient");

class UsersModel {
  async findByEmail(email) {
    try {
      const response = await frappe.getDoc("User", email.toLowerCase());

      // check if user has HR role
      const hasHRRole = response.data.roles?.some(
        (r) =>
          r.role === "HR Manager" || r.role === "HR User" || r.role === "HR",
      );

      return {
        UserId: response.data.name,
        Name: response.data.full_name || response.data.first_name,
        Email: response.data.email,
        Role: hasHRRole ? "HR" : "EMPLOYEE",
      };
    } catch {
      return null;
    }
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
        // get checklist stats
        const checklist = await frappe.listDocType("Employee Checklist", {
          fields: JSON.stringify(["name", "status"]),
          filters: JSON.stringify([["employee", "=", emp.name]]),
        });

        const totalItems = checklist.data.length;
        const completedItems = checklist.data.filter(
          (i) => i.status === "Completed",
        ).length;

        // get document stats
        const docs = await frappe.listDocType("Employee Document", {
          fields: JSON.stringify(["name", "status"]),
          filters: JSON.stringify([["employee", "=", emp.name]]),
        });

        const pendingDocs = docs.data.filter(
          (d) => d.status === "Pending",
        ).length;

        // get equipment stats
        const equipment = await frappe.listDocType("Asset Movement", {
          fields: JSON.stringify([
            "name",
            "asset",
            "movement_date",
            "actual_return_date",
          ]),
          filters: JSON.stringify([
            ["employee", "=", emp.name],
            ["docstatus", "=", 1],
            ["actual_return_date", "=", null],
          ]),
        });

        const borrowingNow = equipment.data.length;

        // get latest equipment details
        let lastItemName = null,
          lastSerialNumber = null,
          lastAssignedAt = null,
          lastReturnedAt = null,
          lastEmployeeAck = null;

        if (equipment.data.length > 0) {
          const latestEq = equipment.data[0];
          try {
            const asset = await frappe.getDoc("Asset", latestEq.asset);
            lastItemName = asset.data.asset_name;
            lastSerialNumber = asset.data.serial_no;
            lastAssignedAt = latestEq.movement_date;
            lastReturnedAt = latestEq.actual_return_date;
            lastEmployeeAck = latestEq.actual_return_date ? 1 : 0;
          } catch {}
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
