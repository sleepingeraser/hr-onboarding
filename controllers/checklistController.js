const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql, getPool } = require("../config/dbConfig");
const { normalizeEmail } = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET;

async function register(req, res) {
  try {
    const { name, email, password, role } = req.body || {};
    const cleanEmail = normalizeEmail(email);

    if (!name || !cleanEmail || !password || !role) {
      return res.status(400).json({ message: "Missing fields" });
    }
    if (!["HR", "EMPLOYEE"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const p = await getPool();

    const exists = await p
      .request()
      .input("Email", sql.NVarChar, cleanEmail)
      .query("SELECT UserId FROM Users WHERE Email=@Email");

    if (exists.recordset.length) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await p
      .request()
      .input("Name", sql.NVarChar, String(name).trim())
      .input("Email", sql.NVarChar, cleanEmail)
      .input("PasswordHash", sql.NVarChar, passwordHash)
      .input("Role", sql.NVarChar, role)
      .query(
        "INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES (@Name, @Email, @PasswordHash, @Role)",
      );

    return res.status(201).json({ message: "Registered successfully" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !password) {
      return res.status(400).json({ message: "Missing email/password" });
    }

    const p = await getPool();
    const result = await p
      .request()
      .input("Email", sql.NVarChar, cleanEmail)
      .query(
        "SELECT UserId, Name, Email, PasswordHash, Role FROM Users WHERE Email=@Email",
      );

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      {
        userId: user.UserId,
        name: user.Name,
        email: user.Email,
        role: user.Role,
      },
      JWT_SECRET,
      { expiresIn: "2h" },
    );

    return res.json({
      token,
      user: {
        userId: user.UserId,
        name: user.Name,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
}

function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { register, login, me };
