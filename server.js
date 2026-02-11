const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const { getPool } = require("./config/dbConfig");
const { authRequired, roleRequired } = require("./middleware/auth");

// routes
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
app.use(express.json());

// serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// health
app.get("/api/ping", (req, res) => res.json({ ok: true }));

// this prevents the “session expired” loop if frontend calls /api/me
app.get("/api/me", authRequired, (req, res) => res.json({ user: req.user }));
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

// keep the SAME endpoints but controllers will fetch from Frappe
app.use("/api", announcementsRoutes);
app.use("/api", faqsRoutes);

// debug routes to directly browse Frappe doctypes
app.use("/api", frappeRoutes);

// start server after DB connects
(async () => {
  try {
    await getPool();
    console.log("Connected to MSSQL");
    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`),
    );
  } catch (err) {
    console.error("DB connection failed:", err);
    process.exit(1);
  }
})();
