const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql, getPool } = require("../config/dbConfig");
const { JWT_SECRET } = require("../middleware/auth");

function signToken(user) {
  return jwt.sign(
    {
      userId: user.UserId,
      name: user.Name,
      email: user.Email,
      role: user.Role,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    console.log("Registration attempt for:", email);

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

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "password must be at least 6 characters",
      });
    }

    const pool = await getPool();

    // check existing
    const existing = await pool
      .request()
      .input("Email", sql.NVarChar(200), email)
      .query("SELECT TOP 1 UserId FROM Users WHERE Email=@Email");

    if (existing.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // insert + return new row
    const inserted = await pool
      .request()
      .input("Name", sql.NVarChar(120), name)
      .input("Email", sql.NVarChar(200), email)
      .input("PasswordHash", sql.NVarChar(200), passwordHash)
      .input("Role", sql.NVarChar(20), role).query(`
        INSERT INTO Users (Name, Email, PasswordHash, Role)
        OUTPUT INSERTED.UserId, INSERTED.Name, INSERTED.Email, INSERTED.Role, INSERTED.CreatedAt
        VALUES (@Name, @Email, @PasswordHash, @Role)
      `);

    const user = inserted.recordset[0];
    console.log("User created:", user.Email);

    // auto-create checklist for user
    await pool.request().input("UserId", sql.Int, user.UserId).query(`
      INSERT INTO UserChecklist (UserId, ItemId, Status)
      SELECT @UserId, ItemId, 'PENDING'
      FROM ChecklistItems
      WHERE IsActive = 1
        AND NOT EXISTS (
          SELECT 1 FROM UserChecklist uc WHERE uc.UserId=@UserId AND uc.ItemId=ChecklistItems.ItemId
        )
    `);

    // auto-assign trainings
    await pool.request().input("UserId", sql.Int, user.UserId).query(`
      INSERT INTO UserTraining (UserId, TrainingId, Attendance)
      SELECT @UserId, TrainingId, 'UPCOMING'
      FROM Trainings
      WHERE NOT EXISTS (
        SELECT 1 FROM UserTraining ut WHERE ut.UserId=@UserId AND ut.TrainingId=Trainings.TrainingId
      )
    `);

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      token,
      user: {
        userId: user.UserId,
        name: user.Name,
        email: user.Email,
        role: user.Role,
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

    console.log("Login attempt for:", email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "email and password are required",
      });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Email", sql.NVarChar(200), email)
      .query(
        "SELECT TOP 1 UserId, Name, Email, PasswordHash, Role FROM Users WHERE Email=@Email",
      );

    if (result.recordset.length === 0) {
      console.log("User not found:", email);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.recordset[0];
    const ok = await bcrypt.compare(password, user.PasswordHash);

    if (!ok) {
      console.log("Invalid password for:", email);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = signToken(user);
    console.log("Login successful for:", email);

    return res.json({
      success: true,
      token,
      user: {
        userId: user.UserId,
        name: user.Name,
        email: user.Email,
        role: user.Role,
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
    console.log("GetMe called for user:", req.user.email);
    return res.json({
      success: true,
      user: req.user,
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
