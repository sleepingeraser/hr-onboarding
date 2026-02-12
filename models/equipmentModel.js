const frappe = require("../services/frappeClient");

class EquipmentModel {
  async createEquipment(itemName, serialNumber, category) {
    return await frappe.createDoc("Asset", {
      asset_name: itemName,
      serial_no: serialNumber,
      asset_category: category || "IT Equipment",
      status: "Available",
      is_active: 1,
    });
  }

  async listEquipment() {
    try {
      const response = await frappe.listDocType("Asset", {
        fields: JSON.stringify([
          "name",
          "asset_name",
          "serial_no",
          "asset_category",
          "status",
          "creation",
        ]),
        order_by: "creation desc",
      });

      return response.data.map((item) => ({
        EquipmentId: item.name,
        ItemName: item.asset_name,
        SerialNumber: item.serial_no,
        Category: item.asset_category,
        Status: item.status === "Available" ? "AVAILABLE" : "ASSIGNED",
        CreatedAt: item.creation,
      }));
    } catch (error) {
      console.error("Error listing equipment:", error);
      return [];
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

      // Update asset status
      await frappe.updateDoc("Asset", equipmentId, {
        status: "Assigned",
      });

      // Create asset movement
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
          "asset.asset_name",
          "asset.serial_no",
          "employee.employee_name",
          "employee.user_id",
        ]),
        filters: JSON.stringify([["docstatus", "=", 1]]),
        order_by: "movement_date desc",
      });

      return response.data.map((movement) => ({
        AssignmentId: movement.name,
        UserId: movement.employee_user_id,
        Name: movement.employee_employee_name,
        EquipmentId: movement.asset,
        ItemName: movement.asset_asset_name,
        SerialNumber: movement.asset_serial_no,
        AssignedAt: movement.movement_date,
        DueBackAt: movement.expected_return_date,
        ReturnedAt: movement.actual_return_date,
        EmployeeAck: movement.actual_return_date ? 1 : 0,
        Notes: movement.notes,
      }));
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
      // Update asset movement
      await frappe.updateDoc("Asset Movement", assignmentId, {
        actual_return_date: new Date(),
      });

      // Update asset status
      await frappe.updateDoc("Asset", equipmentId, {
        status: "Available",
      });

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
          "asset.asset_name",
          "asset.serial_no",
          "asset.asset_category",
        ]),
        filters: JSON.stringify([
          ["employee", "=", employee.name],
          ["docstatus", "=", 1],
        ]),
        order_by: "movement_date desc",
      });

      return response.data.map((movement) => ({
        AssignmentId: movement.name,
        ItemName: movement.asset_asset_name,
        SerialNumber: movement.asset_serial_no,
        Category: movement.asset_asset_category,
        AssignedAt: movement.movement_date,
        DueBackAt: movement.expected_return_date,
        ReturnedAt: movement.actual_return_date,
        EmployeeAck: movement.actual_return_date ? 1 : 0,
        Notes: movement.notes,
      }));
    } catch (error) {
      console.error("Error fetching my equipment:", error);
      return [];
    }
  }

  async ackEquipment(userId, assignmentId) {
    // In Frappe, return date serves as acknowledgment
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
