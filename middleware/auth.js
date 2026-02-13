const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "yuki";

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Missing or invalid Authorization header",
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

function hrRequired(req, res, next) {
  if (req.user.role !== "HR") {
    return res.status(403).json({
      success: false,
      message: "HR access required",
    });
  }
  next();
}

function employeeRequired(req, res, next) {
  if (req.user.role !== "EMPLOYEE") {
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
