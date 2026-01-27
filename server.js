const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// --------- simple JSON "DB" helpers ----------
const USERS_FILE = path.join(__dirname, "data", "users.json");

function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

// --------- auth middleware ----------
function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { userId, email, name, role }
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function roleRequired(role) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(403).json({ message: "Forbidden" });
    if (req.user.role !== role)
      return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

// --------- API routes ----------
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    const cleanEmail = normalizeEmail(email);

    if (!name || !cleanEmail || !password || !role) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const allowedRoles = ["HR", "EMPLOYEE"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const users = readUsers();
    const exists = users.find((u) => u.email === cleanEmail);
    if (exists)
      return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = "u_" + Date.now();

    const newUser = {
      userId,
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash,
      role,
    };

    users.push(newUser);
    writeUsers(users);

    return res.status(201).json({ message: "Registered successfully" });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !password) {
      return res.status(400).json({ message: "Missing email/password" });
    }

    const users = readUsers();
    const user = users.find((u) => u.email === cleanEmail);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "2h" },
    );

    return res.json({
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/me", authRequired, (req, res) => {
  return res.json({ user: req.user });
});

// example protected routes to prove role separation
app.get("/api/hr/ping", authRequired, roleRequired("HR"), (req, res) => {
  res.json({ message: "Hello HR ✅" });
});

app.get(
  "/api/employee/ping",
  authRequired,
  roleRequired("EMPLOYEE"),
  (req, res) => {
    res.json({ message: "Hello Employee ✅" });
  },
);

// SPA-ish fallback (optional)
// app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
