const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const { getPool } = require("./config/dbConfig");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// serve frontend static files
app.use(express.static(path.join(__dirname, "public")));

// serve uploads
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// health check
app.get("/api/ping", (req, res) =>
  res.json({ success: true, message: "Server is running" }),
);

// Import routes
const authRoutes = require("./routes/authRoutes");
const checklistRoutes = require("./routes/checklistRoutes");
const documentsRoutes = require("./routes/documentsRoutes");
const trainingsRoutes = require("./routes/trainingsRoutes");
const equipmentRoutes = require("./routes/equipmentRoutes");
const announcementsRoutes = require("./routes/announcementsRoutes");
const faqsRoutes = require("./routes/faqsRoutes");

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api", checklistRoutes);
app.use("/api", documentsRoutes);
app.use("/api", trainingsRoutes);
app.use("/api", equipmentRoutes);
app.use("/api", announcementsRoutes);
app.use("/api", faqsRoutes);
app.use("/api", hrRoutes);
app.use("/api", gpEmployeesRoutes);

// serve index.html for any non-API routes
app.use((req, res, next) => {
  // skip API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
    return next();
  }

  // for all other routes, serve the index.html
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// DB connection and server start
(async () => {
  try {
    await getPool();
    console.log("Connected to MSSQL");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("DB connection failed:", err);
    process.exit(1);
  }
})();
