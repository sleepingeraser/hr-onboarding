const supabase = require("../config/supabaseConfig");

class DocumentsModel {
  static tableName = "documents";

  static async findById(docId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("doc_id", docId)
      .single();

    if (error) return null;
    return data;
  }

  static async findByUser(userId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async findPending() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(
        `
        *,
        users!inner (
          name,
          email
        )
      `,
      )
      .eq("status", "PENDING")
      .order("uploaded_at", { ascending: true });

    if (error) throw error;

    // transform data
    return (data || []).map((doc) => ({
      DocId: doc.doc_id,
      DocType: doc.doc_type,
      FileUrl: doc.file_url,
      Status: doc.status,
      HRComment: doc.hr_comment,
      UploadedAt: doc.uploaded_at,
      UserId: doc.users.user_id,
      Name: doc.users.name,
      Email: doc.users.email,
    }));
  }

  static async findByStatus(userId, status) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("user_id", userId)
      .eq("status", status)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async create(documentData) {
    const { userId, docType, fileUrl } = documentData;

    const { data, error } = await supabase
      .from(this.tableName)
      .insert([
        {
          user_id: userId,
          doc_type: docType,
          file_url: fileUrl,
          status: "PENDING",
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateStatus(docId, status, comment = null) {
    const updates = { status };
    if (comment !== null) {
      updates.hr_comment = comment;
    }

    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq("doc_id", docId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async countByUser(userId) {
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) throw error;
    return count || 0;
  }

  static async countPendingByUser(userId) {
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "PENDING");

    if (error) throw error;
    return count || 0;
  }

  static async countPending() {
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING");

    if (error) throw error;
    return count || 0;
  }

  static async delete(docId) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq("doc_id", docId);

    if (error) throw error;
    return true;
  }
}

module.exports = DocumentsModel;
