const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const { getPool } = require("./config/dbConfig");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// serve frontend
app.use(express.static(path.join(__dirname, "public")));

// serve uploads
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api", require("./routes/checklistRoutes"));
app.use("/api", require("./routes/documentsRoutes"));
app.use("/api", require("./routes/trainingsRoutes"));
app.use("/api", require("./routes/equipmentRoutes"));
app.use("/api", require("./routes/announcementsRoutes"));
app.use("/api", require("./routes/faqsRoutes"));

// health
app.get("/api/ping", (req, res) => res.json({ ok: true }));

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
