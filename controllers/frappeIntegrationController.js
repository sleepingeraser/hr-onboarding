const frappeService = require("../services/frappeApi");
const { sql, getPool } = require("../config/dbConfig");

// Example: sync employees from your system to Frappe
async function syncEmployeesToFrappe(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT UserId, Name, Email, Role, CreatedAt 
      FROM Users WHERE Role = 'EMPLOYEE'
    `);

    const employees = result.recordset;
    const syncResults = [];

    for (const emp of employees) {
      try {
        // check if employee exists
        const existing = await frappeService.getDocuments("Employee", {
          filters: [["email", "=", emp.Email]],
        });

        let frappeDoc;
        if (existing.data && existing.data.length > 0) {
          // Update existing
          frappeDoc = await frappeService.updateDocument(
            "Employee",
            existing.data[0].name,
            {
              employee_name: emp.Name,
              email: emp.Email,
              custom_hr_system_id: emp.UserId,
            },
          );
        } else {
          // create new
          frappeDoc = await frappeService.createDocument("Employee", {
            employee_name: emp.Name,
            email: emp.Email,
            custom_hr_system_id: emp.UserId,
            date_of_joining: emp.CreatedAt.split("T")[0],
          });
        }

        syncResults.push({
          localId: emp.UserId,
          frappeName: frappeDoc.data.name,
          status: "synced",
        });
      } catch (err) {
        syncResults.push({
          localId: emp.UserId,
          error: err.message,
          status: "failed",
        });
      }
    }

    res.json({
      success: true,
      message: "Sync completed",
      results: syncResults,
    });
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ success: false, message: "Sync failed" });
  }
}

// get training material
async function getFrappeTrainings(req, res) {
  try {
    const result = await frappeService.getDocuments("Training Event", {
      fields: ["name", "title", "starts_on", "ends_on", "location"],
      filters: [["starts_on", ">", new Date().toISOString()]],
      order_by: "starts_on asc",
      limit_page_length: 10,
    });

    res.json({
      success: true,
      trainings: result.data,
    });
  } catch (err) {
    console.error("Error fetching trainings:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch trainings" });
  }
}

module.exports = {
  syncEmployeesToFrappe,
  getFrappeTrainings,
};
