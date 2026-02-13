const frappe = require("../services/frappeClient");

class TrainingsModel {
  async hrListTrainings(limit = 50) {
    try {
      const response = await frappe.listDocType("Training Event", {
        fields: JSON.stringify([
          "name",
          "event_name",
          "starts_on",
          "ends_on",
          "location",
          "description",
        ]),
        order_by: "starts_on desc",
        limit_page_length: limit,
      });

      return response.data.map((training) => ({
        TrainingId: training.name,
        Title: training.event_name,
        StartsAt: training.starts_on,
        EndsAt: training.ends_on,
        Location: training.location,
        Notes: training.description,
      }));
    } catch (error) {
      console.error("Error listing trainings:", error);
      return [];
    }
  }

  async hrCreateTraining({ title, startsAt, endsAt, location, notes }) {
    try {
      // training Event requires 'event_name'
      return await frappe.createDoc("Training Event", {
        event_name: title,
        title: title,
        starts_on: startsAt,
        ends_on: endsAt || startsAt,
        location,
        description: notes,
        training_event_type: "Onboarding",
      });
    } catch (error) {
      console.error("Error creating training:", error);
      throw error;
    }
  }

  async ensureUserTrainingRows(userId) {
    try {
      const employee = await this.getEmployeeByUserId(userId);
      if (!employee) return;

      const trainings = await frappe.listDocType("Training Event", {
        filters: JSON.stringify([["training_event_type", "=", "Onboarding"]]),
      });

      for (const training of trainings.data) {
        // check if already enrolled
        const existing = await frappe.listDocType("Training Event Employee", {
          filters: JSON.stringify([
            ["parent", "=", training.name],
            ["employee", "=", employee.name],
          ]),
        });

        if (existing.data.length === 0) {
          await frappe.createDoc("Training Event Employee", {
            employee: employee.name,
            employee_name: employee.employee_name,
            parent: training.name,
            parentfield: "employees",
            parenttype: "Training Event",
            status: "Open",
          });
        }
      }
    } catch (error) {
      console.error("Error ensuring user training:", error);
    }
  }

  async listEmployeeTrainings(userId) {
    try {
      const employee = await this.getEmployeeByUserId(userId);
      if (!employee) return [];

      const response = await frappe.listDocType("Training Event Employee", {
        fields: JSON.stringify([
          "parent",
          "parent.event_name",
          "parent.starts_on",
          "parent.location",
          "parent.description",
          "status",
        ]),
        filters: JSON.stringify([["employee", "=", employee.name]]),
        order_by: "parent.starts_on asc",
      });

      return response.data.map((item) => ({
        TrainingId: item.parent,
        Title: item.parent_event_name,
        StartsAt: item.parent_starts_on,
        Location: item.parent_location,
        Notes: item.parent_description,
        Attendance: item.status === "Attended" ? "ATTENDED" : "UPCOMING",
      }));
    } catch (error) {
      console.error("Error fetching employee trainings:", error);
      return [];
    }
  }

  async updateAttendance(userId, trainingId, attendance) {
    try {
      const employee = await this.getEmployeeByUserId(userId);
      if (!employee) throw new Error("Employee not found");

      const enrollments = await frappe.listDocType("Training Event Employee", {
        filters: JSON.stringify([
          ["parent", "=", trainingId],
          ["employee", "=", employee.name],
        ]),
      });

      if (enrollments.data.length === 0) {
        throw new Error("Training enrollment not found");
      }

      return await frappe.updateDoc(
        "Training Event Employee",
        enrollments.data[0].name,
        {
          status: attendance === "ATTENDED" ? "Attended" : "Open",
        },
      );
    } catch (error) {
      console.error("Error updating attendance:", error);
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

module.exports = new TrainingsModel();
