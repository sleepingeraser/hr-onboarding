const supabase = require("../config/supabaseConfig");

class AnnouncementsModel {
  static tableName = "announcements";

  static async findAll() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async findById(announcementId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("announcement_id", announcementId)
      .single();

    if (error) return null;
    return data;
  }

  static async findByAudience(role) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .or(`audience.eq.ALL,audience.eq.${role}`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async findLatest(limit = 5) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  static async create(announcementData) {
    const { title, body, audience, createdByUserId } = announcementData;

    const { data, error } = await supabase
      .from(this.tableName)
      .insert([
        {
          title,
          body,
          audience,
          created_by_user_id: createdByUserId,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async update(announcementId, announcementData) {
    const updates = {};
    if (announcementData.title !== undefined)
      updates.title = announcementData.title;
    if (announcementData.body !== undefined)
      updates.body = announcementData.body;
    if (announcementData.audience !== undefined)
      updates.audience = announcementData.audience;

    if (Object.keys(updates).length === 0) return null;

    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq("announcement_id", announcementId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(announcementId) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq("announcement_id", announcementId);

    if (error) throw error;
    return true;
  }

  static async count() {
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return count || 0;
  }

  static async countByAudience(audience) {
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
      .eq("audience", audience);

    if (error) throw error;
    return count || 0;
  }
}

module.exports = AnnouncementsModel;
