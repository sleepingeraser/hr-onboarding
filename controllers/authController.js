const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { normalizeEmail } = require("../middleware/auth");
const usersModel = require("../models/usersModel");

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

    const existing = await usersModel.findByEmail(cleanEmail);
    if (existing)
      return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    await usersModel.createUser({
      name,
      email: cleanEmail,
      passwordHash,
      role,
    });

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

    const user = await usersModel.findByEmail(cleanEmail);
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
