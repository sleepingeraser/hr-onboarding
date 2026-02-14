const supabase = require("../config/supabaseConfig");

class FAQsModel {
  static tableName = "faqs";

  static async findAll() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async findById(faqId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("faq_id", faqId)
      .single();

    if (error) return null;
    return data;
  }

  static async findByCategory(category) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("category", category)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async findActive() {
    return await this.findAll();
  }

  static async create(faqData) {
    const { question, answer, category } = faqData;

    const { data, error } = await supabase
      .from(this.tableName)
      .insert([
        {
          question,
          answer,
          category: category || null,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async update(faqId, faqData) {
    const updates = {};
    if (faqData.question !== undefined) updates.question = faqData.question;
    if (faqData.answer !== undefined) updates.answer = faqData.answer;
    if (faqData.category !== undefined) updates.category = faqData.category;
    if (faqData.isActive !== undefined) updates.is_active = faqData.isActive;

    if (Object.keys(updates).length === 0) return null;

    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq("faq_id", faqId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(faqId) {
    // mark as inactive
    return await this.update(faqId, { isActive: false });
  }

  static async permanentlyDelete(faqId) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq("faq_id", faqId);

    if (error) throw error;
    return true;
  }

  static async count() {
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (error) throw error;
    return count || 0;
  }

  static async countByCategory(category) {
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
      .eq("category", category)
      .eq("is_active", true);

    if (error) throw error;
    return count || 0;
  }

  static async getCategories() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("category")
      .eq("is_active", true)
      .not("category", "is", null)
      .order("category", { ascending: true });

    if (error) throw error;

    // get unique categories
    const categories = [...new Set(data?.map((item) => item.category) || [])];
    return categories;
  }
}

module.exports = FAQsModel;
