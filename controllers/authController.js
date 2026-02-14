const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../config/supabaseConfig");
const { JWT_SECRET } = require("../middleware/auth");

function signToken(user) {
  return jwt.sign(
    {
      userId: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "name, email, password, role are required",
      });
    }

    if (!["HR", "EMPLOYEE"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "role must be HR or EMPLOYEE",
      });
    }

    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("user_id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user
    const { data: user, error: insertError } = await supabase
      .from("users")
      .insert([
        {
          name,
          email,
          password_hash: passwordHash,
          role,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // Auto-create checklist for user
    const { data: checklistItems } = await supabase
      .from("checklist_items")
      .select("item_id")
      .eq("is_active", true);

    if (checklistItems && checklistItems.length > 0) {
      const userChecklist = checklistItems.map((item) => ({
        user_id: user.user_id,
        item_id: item.item_id,
        status: "PENDING",
      }));

      await supabase.from("user_checklist").insert(userChecklist);
    }

    // Auto-assign trainings
    const { data: trainings } = await supabase
      .from("trainings")
      .select("training_id");

    if (trainings && trainings.length > 0) {
      const userTrainings = trainings.map((training) => ({
        user_id: user.user_id,
        training_id: training.training_id,
        attendance: "UPCOMING",
      }));

      await supabase.from("user_training").insert(userTrainings);
    }

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      token,
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "email and password are required",
      });
    }

    // Get user
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = signToken(user);

    return res.json({
      success: true,
      token,
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
}

async function getMe(req, res) {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("user_id, name, email, role, created_at")
      .eq("user_id", req.user.userId)
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      user,
    });
  } catch (err) {
    console.error("GetMe error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = {
  register,
  login,
  getMe,
};
