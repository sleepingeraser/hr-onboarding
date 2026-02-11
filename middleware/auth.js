const jwt = require("jsonwebtoken");

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function authRequired(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing token" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("JWT VERIFY ERROR:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function roleRequired(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

module.exports = {
  authRequired,
  roleRequired,
  normalizeEmail,
};
