const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const { authRequired, roleRequired } = require("./middleware/auth");

// Routes
const authRoutes = require("./routes/authRoutes");
const checklistRoutes = require("./routes/checklistRoutes");
const documentsRoutes = require("./routes/documentsRoutes");
const trainingsRoutes = require("./routes/trainingsRoutes");
const equipmentRoutes = require("./routes/equipmentRoutes");
const announcementsRoutes = require("./routes/announcementsRoutes");
const faqsRoutes = require("./routes/faqsRoutes");
const frappeRoutes = require("./routes/frappeRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// health check
app.get("/api/ping", (req, res) =>
  res.json({ ok: true, message: "Server is running" }),
);

// user info endpoint
app.get("/api/me", authRequired, (req, res) => res.json({ user: req.user }));

// role-specific ping endpoints
app.get("/api/hr/ping", authRequired, roleRequired("HR"), (req, res) =>
  res.json({ message: "Hello HR ✅" }),
);

app.get(
  "/api/employee/ping",
  authRequired,
  roleRequired("EMPLOYEE"),
  (req, res) => res.json({ message: "Hello Employee ✅" }),
);

// mount routes
app.use("/api/auth", authRoutes);
app.use("/api", checklistRoutes);
app.use("/api", documentsRoutes);
app.use("/api", trainingsRoutes);
app.use("/api", equipmentRoutes);
app.use("/api", announcementsRoutes);
app.use("/api", faqsRoutes);
app.use("/api", frappeRoutes);

// error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔗 Frappe backend: ${process.env.FRAPPE_BASE_URL}`);
  console.log(`📋 API documentation: http://localhost:${PORT}/api/ping`);
});

module.exports = app;
