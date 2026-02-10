const checklistModel = require("../models/checklistModel");

async function getChecklist(req, res) {
  try {
    await checklistModel.ensureUserChecklist(req.user.userId);
    const items = await checklistModel.getUserChecklist(req.user.userId);
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function updateChecklistItem(req, res) {
  try {
    const itemId = Number(req.params.itemId);
    const { status } = req.body || {};

    if (!itemId) return res.status(400).json({ message: "Invalid itemId" });
    if (!["PENDING", "DONE"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    await checklistModel.updateChecklistStatus(req.user.userId, itemId, status);
    res.json({ message: "Updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { getChecklist, updateChecklistItem };
