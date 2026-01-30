const API_BASE = "";

// token helpers
function saveToken(token) {
  localStorage.setItem("token", token);
}
function getToken() {
  return localStorage.getItem("token");
}
function clearToken() {
  localStorage.removeItem("token");
}

// improved fetch wrapper (supports JSON + FormData)
async function api(path, options = {}) {
  const headers = options.headers || {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const isFormData = options.body instanceof FormData;

  // Only set JSON header if NOT FormData
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// ---------------- AUTH ----------------
async function registerUser(e) {
  e.preventDefault();

  const name = document.getElementById("name")?.value.trim();
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const role = document.getElementById("role")?.value;

  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role }),
    });

    if (msg) {
      msg.textContent = "Registered! Redirecting to login...";
      msg.style.color = "green";
    }
    setTimeout(() => (window.location.href = "/login.html"), 700);
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

async function loginUser(e) {
  e.preventDefault();

  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;

  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    saveToken(data.token);

    // Redirect based on role
    if (data.user.role === "HR") window.location.href = "/hr.html";
    else window.location.href = "/employee.html";
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

async function loadDashboard(roleExpected) {
  const status = document.getElementById("status");
  const who = document.getElementById("who");

  try {
    const me = await api("/api/me");

    if (who) who.textContent = `${me.user.name} (${me.user.role})`;

    if (me.user.role !== roleExpected) {
      if (status) {
        status.textContent = "Access denied: wrong role.";
        status.style.color = "crimson";
      }
      return;
    }

    // Ping correct route to prove role separation
    const pingPath =
      roleExpected === "HR" ? "/api/hr/ping" : "/api/employee/ping";
    const ping = await api(pingPath);

    if (status) {
      status.textContent = ping.message;
      status.style.color = "green";
    }
  } catch (err) {
    if (status) {
      status.textContent = "Session expired. Please log in again.";
      status.style.color = "crimson";
    }
    clearToken();
    setTimeout(() => (window.location.href = "/login.html"), 700);
  }
}

function logout() {
  clearToken();
  window.location.href = "/index.html";
}

// ---------------- CHECKLIST ----------------
async function loadChecklistPage() {
  const list = document.getElementById("checklistList");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const data = await api("/api/checklist");
    if (!list) return;

    list.innerHTML = "";

    for (const it of data.items) {
      const row = document.createElement("div");
      row.className = "mock-item";
      row.innerHTML = `
        <div>
          <div style="font-weight:800">${it.Title}
            <span class="pill" style="margin-left:8px">${it.Stage}</span>
          </div>
          <div style="color:#475569;font-size:13px">${it.Description || ""}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="badge">${it.Status}</span>
          <button class="btn ${it.Status === "DONE" ? "" : "btn-primary"}">
            ${it.Status === "DONE" ? "Mark Pending" : "Mark Done"}
          </button>
        </div>
      `;

      row.querySelector("button").addEventListener("click", async () => {
        const newStatus = it.Status === "DONE" ? "PENDING" : "DONE";
        await api(`/api/checklist/${it.ItemId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        });
        loadChecklistPage();
      });

      list.appendChild(row);
    }
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// ---------------- DOCUMENTS ----------------
async function loadMyDocuments() {
  const tbody = document.getElementById("docsTbody");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const data = await api("/api/documents/my");
    if (!tbody) return;

    tbody.innerHTML = "";

    for (const d of data.documents) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.DocType}</td>
        <td><a href="${d.FileUrl}" target="_blank" style="text-decoration:underline">View</a></td>
        <td>${d.Status}</td>
        <td>${d.HRComment || "-"}</td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

async function uploadDoc(e) {
  e.preventDefault();

  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  const docType = document.getElementById("docType")?.value;
  const file = document.getElementById("docFile")?.files?.[0];

  if (!file) {
    if (msg) {
      msg.textContent = "Please choose a file.";
      msg.style.color = "crimson";
    }
    return;
  }

  try {
    const fd = new FormData();
    fd.append("docType", docType);
    fd.append("file", file);

    await api("/api/documents/upload", { method: "POST", body: fd });

    if (msg) {
      msg.textContent = "Uploaded!";
      msg.style.color = "green";
    }

    document.getElementById("docFile").value = "";
    loadMyDocuments();
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// HR pending docs
async function loadPendingDocsHR() {
  const tbody = document.getElementById("pendingTbody");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const data = await api("/api/hr/documents/pending");
    if (!tbody) return;

    tbody.innerHTML = "";

    for (const d of data.documents) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.Name}</td>
        <td>${d.DocType}</td>
        <td><a href="${d.FileUrl}" target="_blank" style="text-decoration:underline">View</a></td>
        <td>
          <input id="c-${d.DocId}" placeholder="Comment (optional)"
            style="padding:8px;border-radius:10px;border:1px solid var(--border);width:220px;">
        </td>
        <td style="display:flex;gap:8px">
          <button class="btn btn-primary" data-act="APPROVED" data-id="${d.DocId}">Approve</button>
          <button class="btn" data-act="REJECTED" data-id="${d.DocId}">Reject</button>
        </td>
      `;

      tr.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const docId = btn.dataset.id;
          const status = btn.dataset.act;
          const comment = document.getElementById(`c-${docId}`).value;

          await api(`/api/hr/documents/${docId}`, {
            method: "PATCH",
            body: JSON.stringify({ status, comment }),
          });

          loadPendingDocsHR();
        });
      });

      tbody.appendChild(tr);
    }
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// ---------------- TRAININGS ----------------
async function loadTrainingsPage() {
  const tbody = document.getElementById("trainTbody");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const data = await api("/api/trainings");
    if (!tbody) return;

    tbody.innerHTML = "";

    for (const t of data.trainings) {
      const tr = document.createElement("tr");
      const dt = new Date(t.StartsAt).toLocaleString();

      tr.innerHTML = `
        <td>${t.Title}</td>
        <td>${dt}</td>
        <td>${t.Location || "-"}</td>
        <td>${t.Attendance}</td>
        <td>
          <button class="btn ${t.Attendance === "ATTENDED" ? "" : "btn-primary"}">
            ${t.Attendance === "ATTENDED" ? "Mark Upcoming" : "Mark Attended"}
          </button>
        </td>
      `;

      tr.querySelector("button").addEventListener("click", async () => {
        const newVal = t.Attendance === "ATTENDED" ? "UPCOMING" : "ATTENDED";
        await api(`/api/trainings/${t.TrainingId}/attendance`, {
          method: "PATCH",
          body: JSON.stringify({ attendance: newVal }),
        });
        loadTrainingsPage();
      });

      tbody.appendChild(tr);
    }
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

async function createTraining(e) {
  e.preventDefault();

  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  const title = document.getElementById("tTitle")?.value.trim();
  const startsAt = document.getElementById("tStartsAt")?.value;
  const location = document.getElementById("tLocation")?.value.trim();
  const notes = document.getElementById("tNotes")?.value.trim();

  try {
    await api("/api/hr/trainings", {
      method: "POST",
      body: JSON.stringify({ title, startsAt, location, notes }),
    });

    if (msg) {
      msg.textContent = "Training created!";
      msg.style.color = "green";
    }
    e.target.reset();
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}
