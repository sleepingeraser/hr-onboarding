const supabase = require("../config/supabaseConfig");

async function getTrainings(req, res) {
  try {
    console.log("Getting trainings for user:", req.user.userId);

    // first get all trainings
    const { data: allTrainings, error: trainingsError } = await supabase
      .from("trainings")
      .select("*")
      .order("starts_at", { ascending: true });

    if (trainingsError) throw trainingsError;

    // then get user's attendance records
    const { data: userAttendance, error: attendanceError } = await supabase
      .from("user_training")
      .select("training_id, attendance")
      .eq("user_id", req.user.userId);

    if (attendanceError) throw attendanceError;

    // create a map of attendance
    const attendanceMap = {};
    userAttendance.forEach((record) => {
      attendanceMap[record.training_id] = record.attendance;
    });

    // combine the data
    const trainings = (allTrainings || []).map((training) => ({
      TrainingId: training.training_id,
      Title: training.title || "",
      StartsAt: training.starts_at,
      Location: training.location || "",
      Notes: training.notes || "",
      Attendance: attendanceMap[training.training_id] || "UPCOMING",
    }));

    console.log(`Found ${trainings.length} trainings for user`);

    res.json({
      success: true,
      trainings: trainings,
    });
  } catch (err) {
    console.error("GET trainings error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
}

async function updateAttendance(req, res) {
  try {
    const { trainingId } = req.params;
    const { attendance } = req.body;

    console.log(
      `Updating attendance for training ${trainingId} to ${attendance}`,
    );

    if (!["UPCOMING", "ATTENDED"].includes(attendance)) {
      return res.status(400).json({
        success: false,
        message: "Attendance must be UPCOMING or ATTENDED",
      });
    }

    // check if record exists
    const { data: existingRecord, error: checkError } = await supabase
      .from("user_training")
      .select("*")
      .eq("user_id", req.user.userId)
      .eq("training_id", trainingId)
      .maybeSingle();

    if (checkError) throw checkError;

    if (!existingRecord) {
      // insert if doesn't exist
      const { error: insertError } = await supabase
        .from("user_training")
        .insert([
          {
            user_id: req.user.userId,
            training_id: trainingId,
            attendance: attendance,
          },
        ]);

      if (insertError) throw insertError;
    } else {
      // update if exists
      const { error: updateError } = await supabase
        .from("user_training")
        .update({ attendance: attendance })
        .eq("user_id", req.user.userId)
        .eq("training_id", trainingId);

      if (updateError) throw updateError;
    }

    console.log("Attendance updated successfully");

    res.json({
      success: true,
      message: "Attendance updated",
    });
  } catch (err) {
    console.error("PATCH attendance error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
}

async function createTraining(req, res) {
  try {
    const { title, startsAt, location, notes } = req.body;

    console.log("Creating training with data:", {
      title,
      startsAt,
      location,
      notes,
    });

    if (!title || !startsAt) {
      return res.status(400).json({
        success: false,
        message: "Title and start time required",
      });
    }

    // insert the training
    const { data: training, error: insertError } = await supabase
      .from("trainings")
      .insert([
        {
          title: title,
          starts_at: new Date(startsAt).toISOString(),
          location: location || null,
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    const trainingId = training.training_id;
    console.log("Training created with ID:", trainingId);

    // get all employees
    const { data: employees, error: employeesError } = await supabase
      .from("users")
      .select("user_id")
      .eq("role", "EMPLOYEE");

    if (employeesError) throw employeesError;

    console.log(
      `Found ${employees?.length || 0} employees to assign training to`,
    );

    if (employees && employees.length > 0) {
      // prepare assignments for all employees
      const assignments = employees.map((emp) => ({
        user_id: emp.user_id,
        training_id: trainingId,
        attendance: "UPCOMING",
      }));

      // insert assignments
      const { error: assignError } = await supabase
        .from("user_training")
        .insert(assignments);

      if (assignError) {
        console.error("Assign error:", assignError);
        // training was created successfully
      } else {
        console.log(`Assigned training to ${employees.length} employees`);
      }
    }

    res.status(201).json({
      success: true,
      message: "Training created successfully",
      trainingId: trainingId,
    });
  } catch (err) {
    console.error("POST training error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
}

module.exports = {
  getTrainings,
  updateAttendance,
  createTraining,
};
