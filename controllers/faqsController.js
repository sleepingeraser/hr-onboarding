const supabase = require("../config/supabaseConfig");

async function getFAQs(req, res) {
  try {
    const { data: faqs, error } = await supabase
      .from("faqs")
      .select("*")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      faqs: faqs || [],
    });
  } catch (err) {
    console.error("GET FAQs error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function createFAQ(req, res) {
  try {
    const { question, answer, category } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: "Question and answer required",
      });
    }

    const { error } = await supabase.from("faqs").insert([
      {
        question: question,
        answer: answer,
        category: category || null,
        is_active: true,
      },
    ]);

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "FAQ created",
    });
  } catch (err) {
    console.error("POST FAQ error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function updateFAQ(req, res) {
  try {
    const { faqId } = req.params;
    const { question, answer, category, isActive } = req.body;

    const updates = {};
    if (question !== undefined) updates.question = question;
    if (answer !== undefined) updates.answer = answer;
    if (category !== undefined) updates.category = category;
    if (isActive !== undefined) updates.is_active = isActive;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    const { error } = await supabase
      .from("faqs")
      .update(updates)
      .eq("faq_id", faqId);

    if (error) throw error;

    res.json({
      success: true,
      message: "FAQ updated",
    });
  } catch (err) {
    console.error("PATCH FAQ error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = {
  getFAQs,
  createFAQ,
  updateFAQ,
};
