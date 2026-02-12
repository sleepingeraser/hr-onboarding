const frappe = require("../services/frappeClient");

class AnnouncementsModel {
  async listForRole(role) {
    try {
      const filters = [
        ["published", "=", 1],
        ["schedule_from", "<=", new Date().toISOString().split("T")[0]],
      ];

      if (role !== "HR") {
        filters.push(["audience", "in", ["ALL", role]]);
      }

      const response = await frappe.listDocType("Announcement", {
        fields: JSON.stringify([
          "name",
          "title",
          "body",
          "audience",
          "creation",
          "owner",
        ]),
        filters: JSON.stringify(filters),
        order_by: "creation desc",
      });

      return response.data.map((doc) => ({
        AnnouncementId: doc.name,
        Title: doc.title,
        Body: doc.body,
        Audience: doc.audience || "ALL",
        CreatedAt: doc.creation,
        CreatedBy: doc.owner,
      }));
    } catch (error) {
      console.error("Error fetching announcements:", error);
      return [];
    }
  }

  async createAnnouncement({ title, body, audience, createdByUserId }) {
    return await frappe.createDoc("Announcement", {
      title,
      body,
      audience,
      published: 1,
      schedule_from: new Date().toISOString().split("T")[0],
    });
  }

  async deleteAnnouncement(id) {
    return await frappe.deleteDoc("Announcement", id);
  }

  async listAllAnnouncements() {
    return this.listForRole("HR");
  }
}

module.exports = new AnnouncementsModel();
