const supabase = require("../config/supabaseConfig");

class TrainingsModel {
  static tableName = "trainings";
  static userTableName = "user_training";

  // training methods
  static async findAll() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .order("starts_at", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async findById(trainingId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("training_id", trainingId)
      .single();

    if (error) return null;
    return data;
  }

  static async findUpcoming() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async create(trainingData) {
    const { title, startsAt, location, notes } = trainingData;

    const { data, error } = await supabase
      .from(this.tableName)
      .insert([
        {
          title,
          starts_at: new Date(startsAt).toISOString(),
          location: location || null,
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async update(trainingId, trainingData) {
    const updates = {};
    if (trainingData.title !== undefined) updates.title = trainingData.title;
    if (trainingData.startsAt !== undefined)
      updates.starts_at = new Date(trainingData.startsAt).toISOString();
    if (trainingData.location !== undefined)
      updates.location = trainingData.location;
    if (trainingData.notes !== undefined) updates.notes = trainingData.notes;

    if (Object.keys(updates).length === 0) return null;

    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq("training_id", trainingId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(trainingId) {
    // delete all user associations
    const { error: userError } = await supabase
      .from(this.userTableName)
      .delete()
      .eq("training_id", trainingId);

    if (userError) throw userError;

    // delete the training
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq("training_id", trainingId);

    if (error) throw error;
    return true;
  }

  // user Training methods
  static async getUserTrainings(userId) {
    // get all trainings
    const { data: allTrainings, error: trainingsError } = await supabase
      .from(this.tableName)
      .select("*")
      .order("starts_at", { ascending: true });

    if (trainingsError) throw trainingsError;

    // get user's attendance
    const { data: userAttendance, error: attendanceError } = await supabase
      .from(this.userTableName)
      .select("training_id, attendance")
      .eq("user_id", userId);

    if (attendanceError) throw attendanceError;

    // create attendance map
    const attendanceMap = {};
    userAttendance.forEach((record) => {
      attendanceMap[record.training_id] = record.attendance;
    });

    // combine data
    return (allTrainings || []).map((training) => ({
      TrainingId: training.training_id,
      Title: training.title,
      StartsAt: training.starts_at,
      Location: training.location,
      Notes: training.notes,
      Attendance: attendanceMap[training.training_id] || "UPCOMING",
    }));
  }

  static async getUserUpcomingTrainings(userId) {
    const trainings = await this.getUserTrainings(userId);
    const now = new Date().toISOString();

    return trainings.filter(
      (t) => t.StartsAt > now && t.Attendance === "UPCOMING",
    );
  }

  static async getUserAttendance(userId, trainingId) {
    const { data, error } = await supabase
      .from(this.userTableName)
      .select("*")
      .eq("user_id", userId)
      .eq("training_id", trainingId)
      .maybeSingle();

    if (error) return null;
    return data;
  }

  static async updateAttendance(userId, trainingId, attendance) {
    // check if record exists
    const { data: existing } = await supabase
      .from(this.userTableName)
      .select("*")
      .eq("user_id", userId)
      .eq("training_id", trainingId)
      .maybeSingle();

    if (existing) {
      // update
      const { error } = await supabase
        .from(this.userTableName)
        .update({ attendance })
        .eq("user_id", userId)
        .eq("training_id", trainingId);

      if (error) throw error;
    } else {
      // Insert
      const { error } = await supabase.from(this.userTableName).insert([
        {
          user_id: userId,
          training_id: trainingId,
          attendance,
        },
      ]);

      if (error) throw error;
    }
  }

  static async assignToAllEmployees(trainingId) {
    // get all employees
    const { data: employees, error: empError } = await supabase
      .from("users")
      .select("user_id")
      .eq("role", "EMPLOYEE");

    if (empError) throw empError;

    if (employees && employees.length > 0) {
      // get existing assignments
      const { data: existing } = await supabase
        .from(this.userTableName)
        .select("user_id")
        .eq("training_id", trainingId);

      const existingUserIds = new Set(existing?.map((e) => e.user_id) || []);

      // create new assignments
      const newAssignments = employees
        .filter((emp) => !existingUserIds.has(emp.user_id))
        .map((emp) => ({
          user_id: emp.user_id,
          training_id: trainingId,
          attendance: "UPCOMING",
        }));

      if (newAssignments.length > 0) {
        const { error } = await supabase
          .from(this.userTableName)
          .insert(newAssignments);

        if (error) throw error;
      }
    }
  }

  static async countAttendees(trainingId, attendance = null) {
    let query = supabase
      .from(this.userTableName)
      .select("*", { count: "exact", head: true })
      .eq("training_id", trainingId);

    if (attendance) {
      query = query.eq("attendance", attendance);
    }

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;
  }
}

module.exports = TrainingsModel;
