const announcementsModel = require("../models/announcementsModel");

async function listAnnouncements(req, res) {
  try {
    const role = req.user?.role || "EMPLOYEE";
    const announcements = await announcementsModel.listForRole(role);
    res.json({ announcements });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrCreateAnnouncement(req, res) {
  try {
    const { title, body, audience = "ALL" } = req.body || {};
    if (!title || !body)
      return res.status(400).json({ message: "Missing title/body" });
    if (!["ALL", "EMPLOYEE", "HR"].includes(audience)) {
      return res.status(400).json({ message: "Invalid audience" });
    }

    await announcementsModel.createAnnouncement({
      title,
      body,
      audience,
      createdByUserId: req.user.userId,
    });

    res.status(201).json({ message: "Announcement posted" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrDeleteAnnouncement(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    await announcementsModel.deleteAnnouncement(id);
    res.json({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListAllAnnouncements(req, res) {
  try {
    const announcements = await announcementsModel.listAllAnnouncements();
    res.json({ announcements });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  listAnnouncements,
  hrCreateAnnouncement,
  hrDeleteAnnouncement,
  hrListAllAnnouncements,
};
