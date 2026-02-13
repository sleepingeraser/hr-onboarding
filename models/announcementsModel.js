const frappe = require("../services/frappeClient");

class AnnouncementsModel {
  async listForRole(role) {
    try {
      const filters = [["published", "=", 1]];

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
    const validAudience = audience;

    return await frappe.createDoc("Announcement", {
      title,
      body,
      audience: validAudience,
      published: 1,
      // Remove schedule_from if it doesn't exist
    });
  }

  async deleteAnnouncement(id) {
    return await frappe.deleteDoc("Announcement", id);
  }

  async listAllAnnouncements() {
    try {
      const response = await frappe.listDocType("Announcement", {
        fields: JSON.stringify([
          "name",
          "title",
          "body",
          "audience",
          "creation",
          "owner",
        ]),
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
      console.error("Error fetching all announcements:", error);
      return [];
    }
  }
}

module.exports = new AnnouncementsModel();
