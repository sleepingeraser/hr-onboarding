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

// import routes
const authRoutes = require("./routes/authRoutes");
const checklistRoutes = require("./routes/checklistRoutes");
const documentsRoutes = require("./routes/documentsRoutes");
const trainingsRoutes = require("./routes/trainingsRoutes");
const equipmentRoutes = require("./routes/equipmentRoutes");
const announcementsRoutes = require("./routes/announcementsRoutes");
const faqsRoutes = require("./routes/faqsRoutes");
const hrRoutes = require("./routes/hrRoutes");

// use routes
app.use("/api/auth", authRoutes);
app.use("/api", checklistRoutes);
app.use("/api", documentsRoutes);
app.use("/api", trainingsRoutes);
app.use("/api", equipmentRoutes);
app.use("/api", announcementsRoutes);
app.use("/api", faqsRoutes);
app.use("/api", hrRoutes);

// serve index.html for any non-API routes
app.use((req, res, next) => {
  // skip API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
    return next();
  }

  // for all other routes, serve the index.html
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// sync employees to Frappe (HR only)
async function syncEmployeesToFrappe() {
  try {
    const result = await api("/api/frappe/sync-employees", {
      method: "POST",
    });

    showTemporaryMessage(
      `Synced ${result.results.filter((r) => r.status === "synced").length} employees`,
      "success",
    );
    console.log("Sync results:", result.results);
  } catch (err) {
    console.error("Sync failed:", err);
    showTemporaryMessage("Sync failed", "error");
  }
}

// Get Frappe trainings
async function loadFrappeTrainings() {
  try {
    const result = await api("/api/frappe/trainings");

    const container = document.getElementById("frappeTrainings");
    if (container) {
      container.innerHTML = result.trainings
        .map(
          (t) => `
        <div class="feature">
          <h3>${t.title}</h3>
          <p>${new Date(t.starts_on).toLocaleString()} • ${t.location || "TBD"}</p>
        </div>
      `,
        )
        .join("");
    }
  } catch (err) {
    console.error("Error loading Frappe trainings:", err);
  }
}

// upload document to Frappe
async function uploadToFrappe(file, doctype, docname) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doctype", doctype);
  formData.append("docname", docname);

  try {
    const result = await api("/api/frappe/upload", {
      method: "POST",
      body: formData,
    });

    showTemporaryMessage("File uploaded to Frappe", "success");
    return result;
  } catch (err) {
    console.error("Upload failed:", err);
    showTemporaryMessage("Upload failed", "error");
    throw err;
  }
}

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
