const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getPool, sql } = require("../config/dbConfig");
const { normalizeEmail } = require("../middleware/auth");

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    const cleanEmail = normalizeEmail(email);

    if (!name || !cleanEmail || !password || !role) {
      return res.status(400).json({ message: "Missing fields" });
    }

    if (!["HR", "EMPLOYEE"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const pool = await getPool();

    const exists = await pool
      .request()
      .input("Email", sql.NVarChar, cleanEmail)
      .query("SELECT UserId FROM Users WHERE Email=@Email");

    if (exists.recordset.length) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool
      .request()
      .input("Name", sql.NVarChar, name.trim())
      .input("Email", sql.NVarChar, cleanEmail)
      .input("PasswordHash", sql.NVarChar, passwordHash)
      .input("Role", sql.NVarChar, role).query(`
        INSERT INTO Users (Name, Email, PasswordHash, Role)
        VALUES (@Name, @Email, @PasswordHash, @Role)
      `);

    res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !password) {
      return res.status(400).json({ message: "Missing email/password" });
    }

    const pool = await getPool();

    const result = await pool.request().input("Email", sql.NVarChar, cleanEmail)
      .query(`
        SELECT UserId, Name, Email, PasswordHash, Role
        FROM Users
        WHERE Email=@Email
      `);

    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.PasswordHash);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        userId: user.UserId,
        name: user.Name,
        email: user.Email,
        role: user.Role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" },
    );

    res.json({
      token,
      user: {
        userId: user.UserId,
        name: user.Name,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.me = (req, res) => {
  res.json({ user: req.user });
};
