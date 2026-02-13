const frappe = require("../services/frappeClient");

class EquipmentModel {
  async createEquipment(itemName, serialNumber, category) {
    try {
      // first check if Asset Category exists
      if (category) {
        try {
          await frappe.getDoc("Asset Category", category);
        } catch {
          // category doesn't exist, create it first
          await frappe.createDoc("Asset Category", {
            category_name: category,
          });
        }
      }

      return await frappe.createDoc("Asset", {
        asset_name: itemName,
        serial_no: serialNumber,
        asset_category: category || "IT Equipment",
        status: "Available",
        is_active: 1,
      });
    } catch (error) {
      console.error("Error creating equipment:", error);
      throw error;
    }
  }

  async listEquipment() {
    try {
      const response = await frappe.listDocType("Asset", {
        fields: JSON.stringify([
          "name",
          "asset_name",
          "asset_category",
          "status",
          "creation",
        ]),
        filters: JSON.stringify([["is_active", "=", 1]]),
        order_by: "creation desc",
      });

      // Fetch serial numbers separately
      const equipmentList = [];
      for (const item of response.data) {
        const details = await this.getEquipmentDetails(item.name);
        equipmentList.push({
          EquipmentId: item.name,
          ItemName: item.asset_name,
          SerialNumber: details?.serial_no || null,
          Category: item.asset_category,
          Status: item.status === "Available" ? "AVAILABLE" : "ASSIGNED",
          CreatedAt: item.creation,
        });
      }

      return equipmentList;
    } catch (error) {
      console.error("Error listing equipment:", error);
      return [];
    }
  }

  async getEquipmentDetails(equipmentId) {
    try {
      const response = await frappe.getDoc("Asset", equipmentId);
      return response.data;
    } catch {
      return null;
    }
  }

  async getEquipmentStatus(equipmentId) {
    try {
      const response = await frappe.getDoc("Asset", equipmentId);
      return {
        Status: response.data.status === "Available" ? "AVAILABLE" : "ASSIGNED",
      };
    } catch (error) {
      return null;
    }
  }

  async assignEquipment({ userId, equipmentId, dueBackAt, notes }) {
    try {
      const employee = await this.getEmployeeByUserId(userId);
      if (!employee) throw new Error("Employee not found");

      // update asset status
      await frappe.updateDoc("Asset", equipmentId, {
        status: "Assigned",
      });

      // create asset movement
      return await frappe.createDoc("Asset Movement", {
        asset: equipmentId,
        employee: employee.name,
        movement_type: "Issue",
        movement_date: new Date(),
        expected_return_date: dueBackAt,
        reference_doctype: "Employee",
        reference_name: employee.name,
        notes,
      });
    } catch (error) {
      console.error("Error assigning equipment:", error);
      throw error;
    }
  }

  async listAssignments() {
    try {
      const response = await frappe.listDocType("Asset Movement", {
        fields: JSON.stringify([
          "name",
          "asset",
          "employee",
          "movement_date",
          "expected_return_date",
          "actual_return_date",
          "notes",
        ]),
        filters: JSON.stringify([["docstatus", "=", 1]]),
        order_by: "movement_date desc",
      });

      // fetch additional details separately
      const assignments = [];
      for (const movement of response.data) {
        // get asset details
        const asset = movement.asset
          ? await this.getEquipmentDetails(movement.asset)
          : null;

        // Get employee details
        let employeeName = "",
          employeeUserId = "";
        if (movement.employee) {
          try {
            const emp = await frappe.getDoc("Employee", movement.employee);
            employeeName = emp.data.employee_name;
            employeeUserId = emp.data.user_id;
          } catch {}
        }

        assignments.push({
          AssignmentId: movement.name,
          UserId: employeeUserId,
          Name: employeeName,
          EquipmentId: movement.asset,
          ItemName: asset?.asset_name || null,
          SerialNumber: asset?.serial_no || null,
          AssignedAt: movement.movement_date,
          DueBackAt: movement.expected_return_date,
          ReturnedAt: movement.actual_return_date,
          EmployeeAck: movement.actual_return_date ? 1 : 0,
          Notes: movement.notes,
        });
      }

      return assignments;
    } catch (error) {
      console.error("Error listing assignments:", error);
      return [];
    }
  }

  async getAssignment(assignmentId) {
    try {
      const response = await frappe.getDoc("Asset Movement", assignmentId);
      return {
        EquipmentId: response.data.asset,
        ReturnedAt: response.data.actual_return_date,
      };
    } catch {
      return null;
    }
  }

  async markReturned(assignmentId, equipmentId) {
    try {
      // update asset movement
      await frappe.updateDoc("Asset Movement", assignmentId, {
        actual_return_date: new Date(),
      });

      // update asset status
      if (equipmentId) {
        await frappe.updateDoc("Asset", equipmentId, {
          status: "Available",
        });
      }

      return { message: "Returned" };
    } catch (error) {
      console.error("Error marking returned:", error);
      throw error;
    }
  }

  async listMyEquipment(userId) {
    try {
      const employee = await this.getEmployeeByUserId(userId);
      if (!employee) return [];

      const response = await frappe.listDocType("Asset Movement", {
        fields: JSON.stringify([
          "name",
          "asset",
          "movement_date",
          "expected_return_date",
          "actual_return_date",
          "notes",
        ]),
        filters: JSON.stringify([
          ["employee", "=", employee.name],
          ["docstatus", "=", 1],
        ]),
        order_by: "movement_date desc",
      });

      const equipmentList = [];
      for (const movement of response.data) {
        const asset = movement.asset
          ? await this.getEquipmentDetails(movement.asset)
          : null;

        equipmentList.push({
          AssignmentId: movement.name,
          ItemName: asset?.asset_name || null,
          SerialNumber: asset?.serial_no || null,
          Category: asset?.asset_category || null,
          AssignedAt: movement.movement_date,
          DueBackAt: movement.expected_return_date,
          ReturnedAt: movement.actual_return_date,
          EmployeeAck: movement.actual_return_date ? 1 : 0,
          Notes: movement.notes,
        });
      }

      return equipmentList;
    } catch (error) {
      console.error("Error fetching my equipment:", error);
      return [];
    }
  }

  async ackEquipment(userId, assignmentId) {
    return await this.markReturned(assignmentId, null);
  }

  async getEmployeeByUserId(userId) {
    try {
      const response = await frappe.listDocType("Employee", {
        filters: JSON.stringify([["user_id", "=", userId]]),
      });
      return response.data[0] || null;
    } catch {
      return null;
    }
  }
}

module.exports = new EquipmentModel();
