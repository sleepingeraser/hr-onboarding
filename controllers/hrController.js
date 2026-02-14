const supabase = require("../config/supabaseConfig");

async function getEmployees(req, res) {
  try {
    console.log("Getting employees list for HR:", req.user.email);

    // get all employees
    const { data: employees, error: employeesError } = await supabase
      .from("users")
      .select("*")
      .eq("role", "EMPLOYEE")
      .order("created_at", { ascending: false });

    if (employeesError) throw employeesError;

    // get additional stats for each employee
    const employeesWithStats = await Promise.all(
      employees.map(async (employee) => {
        // checklist stats
        const { data: checklist, error: checklistError } = await supabase
          .from("user_checklist")
          .select("status")
          .eq("user_id", employee.user_id);

        if (checklistError) throw checklistError;

        const checklistTotal = checklist.length;
        const checklistDone = checklist.filter(
          (item) => item.status === "DONE",
        ).length;

        // pending docs
        const { data: pendingDocs, error: docsError } = await supabase
          .from("documents")
          .select("doc_id")
          .eq("user_id", employee.user_id)
          .eq("status", "PENDING");

        if (docsError) throw docsError;

        // currently borrowing
        const { data: borrowing, error: borrowingError } = await supabase
          .from("user_equipment")
          .select("assignment_id")
          .eq("user_id", employee.user_id)
          .is("returned_at", null);

        if (borrowingError) throw borrowingError;

        // latest equipment
        const { data: latestEquip, error: latestError } = await supabase
          .from("user_equipment")
          .select(
            `
            assigned_at,
            returned_at,
            employee_ack,
            equipment!inner (
              item_name,
              serial_number
            )
          `,
          )
          .eq("user_id", employee.user_id)
          .order("assigned_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestError) throw latestError;

        return {
          UserId: employee.user_id,
          Name: employee.name,
          Email: employee.email,
          Role: employee.role,
          CreatedAt: employee.created_at,
          ChecklistTotal: checklistTotal,
          ChecklistDone: checklistDone,
          PendingDocs: pendingDocs.length,
          BorrowingNow: borrowing.length,
          LastItemName: latestEquip?.equipment?.item_name || null,
          LastSerialNumber: latestEquip?.equipment?.serial_number || null,
          LastAssignedAt: latestEquip?.assigned_at || null,
          LastReturnedAt: latestEquip?.returned_at || null,
          LastEmployeeAck: latestEquip?.employee_ack || false,
        };
      }),
    );

    res.json({
      success: true,
      employees: employeesWithStats,
    });
  } catch (err) {
    console.error("GET employees error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function pingHR(req, res) {
  console.log("HR ping successful for:", req.user.email);
  res.json({
    success: true,
    message: "HR session active",
  });
}

async function pingEmployee(req, res) {
  console.log("Employee ping successful for:", req.user.email);
  res.json({
    success: true,
    message: "Employee session active",
  });
}

module.exports = {
  getEmployees,
  pingHR,
  pingEmployee,
};
