const supabase = require("./supabaseConfig");

class DB {
  static async query(query, params = []) {
    // for raw SQL queries when needed
    const { data, error } = await supabase.rpc("exec_sql", {
      query_string: query,
      params: params,
    });

    if (error) throw error;
    return data;
  }

  static from(table) {
    return supabase.from(table);
  }
}

module.exports = DB;
