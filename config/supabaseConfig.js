const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key exists:", !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// test the connection
(async () => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("count", { count: "exact", head: true });
    if (error) {
      console.error("Supabase connection test failed:", error.message);
    } else {
      console.log("Supabase connection successful!");
    }
  } catch (err) {
    console.error("Supabase connection error:", err.message);
  }
})();

module.exports = supabase;
