const frappe = require("../services/frappeClient");

class ChecklistModel {
  async ensureUserChecklist(userId) {
    // Auto-create checklist items for new employee
    try {
      // Check if employee exists in Frappe
      const employee = await this.getEmployeeByUserId(userId);
      if (!employee) return;

      // Get all active checklist templates
      const templates = await frappe.listDocType(
        "Onboarding Checklist Template",
        {
          filters: JSON.stringify([["is_active", "=", 1]]),
          order_by: "stage asc",
        },
      );

      for (const template of templates.data) {
        // Check if already assigned
        const existing = await frappe.listDocType("Employee Checklist", {
          filters: JSON.stringify([
            ["employee", "=", employee.name],
            ["checklist_item", "=", template.name],
          ]),
        });

        if (existing.data.length === 0) {
          await frappe.createDoc("Employee Checklist", {
            employee: employee.name,
            checklist_item: template.name,
            status: "Pending",
            assigned_date: new Date(),
          });
        }
      }
    } catch (error) {
      console.error("Error ensuring user checklist:", error);
    }
  }

  async getUserChecklist(userId) {
    try {
      const employee = await this.getEmployeeByUserId(userId);
      if (!employee) return [];

      const response = await frappe.listDocType("Employee Checklist", {
        fields: JSON.stringify([
          "name",
          "checklist_item",
          "status",
          "completed_date",
          "checklist_item.title",
          "checklist_item.stage",
          "checklist_item.description",
        ]),
        filters: JSON.stringify([["employee", "=", employee.name]]),
        order_by: "checklist_item.stage asc",
      });

      return response.data.map((item) => ({
        ItemId: item.checklist_item,
        Title: item.checklist_item_title,
        Stage: item.checklist_item_stage,
        Description: item.checklist_item_description,
        Status: item.status === "Completed" ? "DONE" : "PENDING",
        UpdatedAt: item.completed_date || item.creation,
      }));
    } catch (error) {
      console.error("Error fetching user checklist:", error);
      return [];
    }
  }

  async updateChecklistStatus(userId, itemId, status) {
    try {
      const employee = await this.getEmployeeByUserId(userId);
      if (!employee) throw new Error("Employee not found");

      const checklistItems = await frappe.listDocType("Employee Checklist", {
        filters: JSON.stringify([
          ["employee", "=", employee.name],
          ["checklist_item", "=", itemId],
        ]),
      });

      if (checklistItems.data.length === 0) {
        throw new Error("Checklist item not found");
      }

      return await frappe.updateDoc(
        "Employee Checklist",
        checklistItems.data[0].name,
        {
          status: status === "DONE" ? "Completed" : "Pending",
          completed_date: status === "DONE" ? new Date() : null,
        },
      );
    } catch (error) {
      console.error("Error updating checklist status:", error);
      throw error;
    }
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

module.exports = new ChecklistModel();
