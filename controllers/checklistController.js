const supabase = require("../config/supabaseConfig");

async function getChecklist(req, res) {
  try {
    const { data: checklist, error } = await supabase
      .from("user_checklist")
      .select(
        `
        status,
        updated_at,
        checklist_items!inner (
          item_id,
          title,
          stage,
          description,
          is_active
        )
      `,
      )
      .eq("user_id", req.user.userId)
      .eq("checklist_items.is_active", true)
      .order("item_id", { foreignTable: "checklist_items" });

    if (error) throw error;

    // transform the data to match the expected format
    const items = checklist.map((item) => ({
      ItemId: item.checklist_items.item_id,
      Title: item.checklist_items.title,
      Stage: item.checklist_items.stage,
      Description: item.checklist_items.description,
      Status: item.status,
      UpdatedAt: item.updated_at,
    }));

    // Sort by stage
    const stageOrder = { DAY1: 1, WEEK1: 2, MONTH1: 3 };
    items.sort((a, b) => stageOrder[a.Stage] - stageOrder[b.Stage]);

    res.json({
      success: true,
      items: items,
    });
  } catch (err) {
    console.error("GET checklist error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function updateChecklistItem(req, res) {
  try {
    const { itemId } = req.params;
    const { status } = req.body;

    if (!["PENDING", "DONE"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be PENDING or DONE",
      });
    }

    const { error } = await supabase
      .from("user_checklist")
      .update({
        status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", req.user.userId)
      .eq("item_id", itemId);

    if (error) throw error;

    res.json({
      success: true,
      message: "Checklist updated",
    });
  } catch (err) {
    console.error("PATCH checklist error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = {
  getChecklist,
  updateChecklistItem,
};
