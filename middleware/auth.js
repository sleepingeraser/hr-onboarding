const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "yuki";

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    console.log("Auth failed: No Bearer token");
    return res.status(401).json({
      success: false,
      message: "Missing or invalid Authorization header",
    });
  }

  const token = header.substring(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    console.log("Auth successful for user:", payload.email);
    next();
  } catch (err) {
    console.log("Token verification failed:", err.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

function hrRequired(req, res, next) {
  if (req.user.role !== "HR") {
    console.log("HR access denied for user:", req.user.email);
    return res.status(403).json({
      success: false,
      message: "HR access required",
    });
  }
  next();
}

function employeeRequired(req, res, next) {
  if (req.user.role !== "EMPLOYEE") {
    console.log("Employee access denied for user:", req.user.email);
    return res.status(403).json({
      success: false,
      message: "Employee access required",
    });
  }
  next();
}

module.exports = {
  authRequired,
  hrRequired,
  employeeRequired,
  JWT_SECRET,
};
