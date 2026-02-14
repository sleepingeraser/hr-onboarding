const supabase = require("../config/supabaseConfig");

class ChecklistModel {
  static tableName = "checklist_items";
  static userTableName = "user_checklist";

  // checklist items methods
  static async findAllItems() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("is_active", true)
      .order("item_id");

    if (error) throw error;
    return data || [];
  }

  static async findItemById(itemId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("item_id", itemId)
      .single();

    if (error) return null;
    return data;
  }

  static async createItem(itemData) {
    const { title, stage, description } = itemData;

    const { data, error } = await supabase
      .from(this.tableName)
      .insert([
        {
          title,
          stage,
          description: description || null,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateItem(itemId, itemData) {
    const updates = {};
    if (itemData.title !== undefined) updates.title = itemData.title;
    if (itemData.stage !== undefined) updates.stage = itemData.stage;
    if (itemData.description !== undefined)
      updates.description = itemData.description;
    if (itemData.isActive !== undefined) updates.is_active = itemData.isActive;

    if (Object.keys(updates).length === 0) return null;

    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq("item_id", itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteItem(itemId) {
    return await this.updateItem(itemId, { isActive: false });
  }

  // user checklist methods
  static async getUserChecklist(userId) {
    const { data, error } = await supabase
      .from(this.userTableName)
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
      .eq("user_id", userId)
      .eq("checklist_items.is_active", true)
      .order("item_id", { foreignTable: "checklist_items" });

    if (error) throw error;

    // transform data
    return (data || []).map((item) => ({
      ItemId: item.checklist_items.item_id,
      Title: item.checklist_items.title,
      Stage: item.checklist_items.stage,
      Description: item.checklist_items.description,
      Status: item.status,
      UpdatedAt: item.updated_at,
    }));
  }

  static async getUserItemStatus(userId, itemId) {
    const { data, error } = await supabase
      .from(this.userTableName)
      .select("*")
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .maybeSingle();

    if (error) return null;
    return data;
  }

  static async updateUserItemStatus(userId, itemId, status) {
    const { error } = await supabase
      .from(this.userTableName)
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("item_id", itemId);

    if (error) throw error;
  }

  static async initializeUserChecklist(userId) {
    // Get all active checklist items
    const { data: items, error: itemsError } = await supabase
      .from(this.tableName)
      .select("item_id")
      .eq("is_active", true);

    if (itemsError) throw itemsError;

    if (items && items.length > 0) {
      // Create user checklist entries
      const userChecklist = items.map((item) => ({
        user_id: userId,
        item_id: item.item_id,
        status: "PENDING",
      }));

      const { error: insertError } = await supabase
        .from(this.userTableName)
        .insert(userChecklist);

      if (insertError) throw insertError;
    }
  }

  static async getUserProgress(userId) {
    const { data, error } = await supabase
      .from(this.userTableName)
      .select("status")
      .eq("user_id", userId);

    if (error) throw error;

    const total = data?.length || 0;
    const done = data?.filter((item) => item.status === "DONE").length || 0;

    return {
      total,
      done,
      percentage: total ? Math.round((done / total) * 100) : 0,
    };
  }
}

module.exports = ChecklistModel;
