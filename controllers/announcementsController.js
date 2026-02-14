const supabase = require("../config/supabaseConfig");

async function getAnnouncements(req, res) {
  try {
    const { data: announcements, error } = await supabase
      .from("announcements")
      .select(
        `
        announcement_id,
        title,
        body,
        audience,
        created_at,
        created_by_user_id
      `,
      )
      .or(`audience.eq.ALL,audience.eq.${req.user.role}`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      announcements: announcements || [],
    });
  } catch (err) {
    console.error("GET announcements error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function createAnnouncement(req, res) {
  try {
    const { title, body, audience } = req.body;

    if (!title || !body || !audience) {
      return res.status(400).json({
        success: false,
        message: "Title, body, and audience required",
      });
    }

    if (!["ALL", "HR", "EMPLOYEE"].includes(audience)) {
      return res.status(400).json({
        success: false,
        message: "Invalid audience",
      });
    }

    const { error } = await supabase.from("announcements").insert([
      {
        title: title,
        body: body,
        audience: audience,
        created_by_user_id: req.user.userId,
      },
    ]);

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "Announcement created",
    });
  } catch (err) {
    console.error("POST announcement error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function deleteAnnouncement(req, res) {
  try {
    const { announcementId } = req.params;

    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("announcement_id", announcementId);

    if (error) throw error;

    res.json({
      success: true,
      message: "Announcement deleted",
    });
  } catch (err) {
    console.error("DELETE announcement error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
};
