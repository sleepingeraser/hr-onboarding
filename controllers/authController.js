const authService = require("../services/authService");

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing fields" });
    }

    if (!["HR", "EMPLOYEE"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    await authService.register({ name, email, password, role });
    res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    console.error(err);

    if (err.message.includes("already exists")) {
      return res.status(409).json({ message: "Email already registered" });
    }

    res.status(500).json({ message: err.message || "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing email/password" });
    }

    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Invalid credentials" });
  }
};

exports.me = (req, res) => {
  res.json({ user: req.user });
};
