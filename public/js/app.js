const API_BASE = "";

// token helpers
function saveToken(token) {
  localStorage.setItem("token", token);
  console.log("Token saved");
}

function getToken() {
  return localStorage.getItem("token");
}

function clearToken() {
  localStorage.removeItem("token");
  console.log("Token cleared");
}

// improved fetch wrapper (supports JSON + FormData)
async function api(path, options = {}) {
  const headers = options.headers || {};
  const token = getToken();

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("API call with token to:", path);
  } else {
    console.log("API call without token to:", path);
  }

  const isFormData = options.body instanceof FormData;

  // set JSON header if NOT FormData
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.log("API error response:", res.status, data);

      // if token expired, clear it
      if (res.status === 401) {
        console.log("Token expired, clearing...");
        clearToken();

        // only redirect if not already on login page
        if (
          !window.location.pathname.includes("login.html") &&
          !window.location.pathname.includes("register.html") &&
          !window.location.pathname.includes("index.html")
        ) {
          setTimeout(() => {
            window.location.href = "/login.html";
          }, 1000);
        }
      }

      throw new Error(
        data.message || `Request failed with status ${res.status}`,
      );
    }
    return data;
  } catch (err) {
    console.error("API Error:", err);
    throw err;
  }
}

// simple date formatting
function fmtDT(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

// ---------------- AUTH ----------------
async function registerUser(e) {
  e.preventDefault();
  console.log("Register function called");

  const name = document.getElementById("name")?.value.trim();
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const role = document.getElementById("role")?.value;

  const msg = document.getElementById("msg");
  if (msg) {
    msg.textContent = "Processing...";
    msg.style.color = "blue";
  }

  try {
    console.log("Sending registration request:", { name, email, role });

    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role }),
    });

    console.log("Registration successful:", data);

    if (data.token) {
      saveToken(data.token);

      if (msg) {
        msg.textContent = "Registration successful! Redirecting...";
        msg.style.color = "green";
      }

      // redirect based on role
      setTimeout(() => {
        if (data.user.role === "HR") {
          window.location.href = "/hr.html";
        } else {
          window.location.href = "/employee.html";
        }
      }, 1500);
    }
  } catch (err) {
    console.error("Registration error:", err);
    if (msg) {
      msg.textContent = err.message || "Registration failed";
      msg.style.color = "crimson";
    }
  }
}

async function loginUser(e) {
  e.preventDefault();
  console.log("Login function called");

  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;

  const msg = document.getElementById("msg");
  if (msg) {
    msg.textContent = "Processing...";
    msg.style.color = "blue";
  }

  try {
    console.log("Sending login request for:", email);

    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    console.log("Login successful:", data);

    if (data.token) {
      saveToken(data.token);

      if (msg) {
        msg.textContent = "Login successful! Redirecting...";
        msg.style.color = "green";
      }

      // redirect based on role
      setTimeout(() => {
        if (data.user.role === "HR") {
          window.location.href = "/hr.html";
        } else {
          window.location.href = "/employee.html";
        }
      }, 1500);
    }
  } catch (err) {
    console.error("Login error:", err);
    if (msg) {
      msg.textContent = err.message || "Invalid email or password";
      msg.style.color = "crimson";
    }
  }
}

async function loadDashboard(roleExpected) {
  console.log("Loading dashboard for role:", roleExpected);

  const status = document.getElementById("status");
  const who = document.getElementById("who");

  // check if token exists
  const token = getToken();
  if (!token) {
    console.log("No token found, redirecting to login");
    if (status) {
      status.textContent = "Please log in first.";
      status.style.color = "crimson";
    }
    setTimeout(() => {
      window.location.href = "/login.html";
    }, 1500);
    return;
  }

  try {
    const me = await api("/api/auth/me");
    console.log("User data:", me);

    if (who) who.textContent = `${me.user.name} (${me.user.role})`;

    if (me.user.role !== roleExpected) {
      console.log("Role mismatch:", me.user.role, "expected:", roleExpected);
      if (status) {
        status.textContent = "Access denied: wrong role.";
        status.style.color = "crimson";
      }
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 2000);
      return;
    }

    // ping correct route to prove role separation
    const pingPath =
      roleExpected === "HR" ? "/api/hr/ping" : "/api/employee/ping";
    const ping = await api(pingPath);
    console.log("Ping response:", ping);

    if (status) {
      status.textContent = ping.message || "Session active";
      status.style.color = "green";
    }

    // load dashboard widgets
    if (roleExpected === "HR") {
      await loadHRDashboardWidgets();
    } else {
      await loadEmployeeDashboardWidgets();
    }
  } catch (err) {
    console.error("Dashboard error:", err);
    if (status) {
      status.textContent = "Session expired. Please log in again.";
      status.style.color = "crimson";
    }
    clearToken();
    setTimeout(() => (window.location.href = "/login.html"), 2000);
  }
}

function logout() {
  console.log("Logging out");
  clearToken();
  window.location.href = "/index.html";
}

// ---------------- DASHBOARD WIDGETS ----------------
function fmtDate(dt) {
  if (!dt) return "-";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return "-";
  }
}

async function loadHRDashboardWidgets() {
  console.log("Loading HR dashboard widgets");

  const tbody = document.getElementById("hrEmpTbody");
  const stats = document.getElementById("hrStats");
  if (!tbody && !stats) return;

  try {
    const data = await api("/api/hr/employees");
    console.log("HR employees data:", data);

    // top stats
    if (stats) {
      const employees = data.employees || [];
      const total = employees.length;
      const withPendingDocs = employees.filter(
        (e) => (e.PendingDocs || 0) > 0,
      ).length;
      const borrowingNow = employees.reduce(
        (sum, e) => sum + (e.BorrowingNow || 0),
        0,
      );

      stats.innerHTML = `
        <div class="feature">
          <h3>Total Employees</h3>
          <p style="font-weight:900; font-size:20px">${total}</p>
        </div>
        <div class="feature">
          <h3>Employees w/ Pending Docs</h3>
          <p style="font-weight:900; font-size:20px">${withPendingDocs}</p>
        </div>
        <div class="feature">
          <h3>Items Currently Borrowed</h3>
          <p style="font-weight:900; font-size:20px">${borrowingNow}</p>
        </div>
      `;
    }

    // employee table
    if (!tbody) return;
    tbody.innerHTML = "";

    const tdBase = `
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: 1.3;
    `;

    for (const e of data.employees || []) {
      const total = Number(e.ChecklistTotal || 0);
      const done = Number(e.ChecklistDone || 0);
      const pct = total ? Math.round((done / total) * 100) : 0;

      const lastItem = e.LastItemName
        ? `${e.LastItemName}${e.LastSerialNumber ? ` (${e.LastSerialNumber})` : ""}`
        : "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="${tdBase}">
          <div style="font-weight:900">${e.Name}</div>
          <div style="color:var(--muted); font-size:13px">${e.Email}</div>
        </td>

        <td style="${tdBase}">${fmtDate(e.CreatedAt)}</td>

        <td style="${tdBase}">
          <div style="font-weight:900">${done}/${total}</div>
          <div style="color:var(--muted); font-size:13px">${pct}%</div>
        </td>

        <td style="${tdBase}">${e.PendingDocs || 0}</td>

        <td style="${tdBase}">${e.BorrowingNow || 0}</td>

        <td style="${tdBase}">
          <div style="font-weight:800">${lastItem}</div>
          <div style="color:var(--muted); font-size:13px; margin-top:4px">
            Last borrowed: ${fmtDate(e.LastAssignedAt)}
          </div>
        </td>

        <td style="${tdBase}">${fmtDate(e.LastAssignedAt)}</td>
        <td style="${tdBase}">${fmtDate(e.LastReturnedAt)}</td>

        <td style="${tdBase}">
          ${e.LastAssignedAt ? (e.LastEmployeeAck ? "Yes" : "No") : "-"}
        </td>

        <td style="${tdBase}">
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-start">
            <a class="btn btn-primary btn-sm" href="/hr-equipment.html">Equipment</a>
            <a class="btn btn-sm" href="/hr-documents.html">Docs</a>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error("Error loading HR widgets:", err);
  }
}

async function loadEmployeeDashboardWidgets() {
  console.log("Loading employee dashboard widgets");

  const stats = document.getElementById("empStats");
  const upcomingBox = document.getElementById("empUpcoming");
  const announceBox = document.getElementById("empAnnouncements");

  try {
    // checklist progress
    let checklist = { items: [] };
    try {
      checklist = await api("/api/checklist");
      console.log("Checklist data:", checklist);
    } catch (err) {
      console.error("Error loading checklist:", err);
    }

    const items = checklist.items || [];
    const total = items.length;
    const done = items.filter((x) => x.Status === "DONE").length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    // docs
    let docs = { documents: [] };
    try {
      docs = await api("/api/documents/my");
      console.log("Documents data:", docs);
    } catch (err) {
      console.error("Error loading docs:", err);
    }
    const pendingDocs = (docs.documents || []).filter(
      (d) => d.Status === "PENDING",
    ).length;

    // equipment
    let equip = { equipment: [] };
    try {
      equip = await api("/api/equipment/my");
      console.log("Equipment data:", equip);
    } catch (err) {
      console.error("Error loading equipment:", err);
    }
    const unacked = (equip.equipment || []).filter(
      (e) => !e.EmployeeAck && !e.ReturnedAt,
    ).length;

    if (stats) {
      stats.innerHTML = `
        <div class="feature">
          <h3>Checklist Progress</h3>
          <p style="font-weight:900; font-size:20px">${pct}%</p>
          <p>${done}/${total} tasks done</p>
        </div>
        <div class="feature">
          <h3>Documents Pending</h3>
          <p style="font-weight:900; font-size:20px">${pendingDocs}</p>
          <p>Waiting for HR review</p>
        </div>
        <div class="feature">
          <h3>Equipment to Acknowledge</h3>
          <p style="font-weight:900; font-size:20px">${unacked}</p>
          <p>Tap “My Equipment” to confirm</p>
        </div>
      `;
    }

    // trainings
    if (upcomingBox) {
      let trainings = { trainings: [] };
      try {
        trainings = await api("/api/trainings");
        console.log("Trainings data:", trainings);
      } catch (err) {
        console.error("Error loading trainings:", err);
      }

      const upcoming = (trainings.trainings || [])
        .filter((t) => t.Attendance === "UPCOMING")
        .slice(0, 3);

      upcomingBox.innerHTML = upcoming.length
        ? upcoming
            .map(
              (t) => `
              <div class="mock-item">
                <div>
                  <div style="font-weight:900">${t.Title}</div>
                  <div style="color:var(--muted); font-size:13px">${fmtDate(
                    t.StartsAt,
                  )} • ${t.Location || "-"}</div>
                </div>
                <span class="badge">UPCOMING</span>
              </div>
            `,
            )
            .join("")
        : `<div class="feature">No upcoming trainings.</div>`;
    }

    // announcements
    if (announceBox) {
      let anns = { announcements: [] };
      try {
        anns = await api("/api/announcements");
        console.log("Announcements data:", anns);
      } catch (err) {
        console.error("Error loading announcements:", err);
      }

      const top = (anns.announcements || []).slice(0, 2);
      announceBox.innerHTML = top.length
        ? top
            .map(
              (a) => `
              <div class="feature">
                <div style="font-weight:900">${a.Title}</div>
                <div style="color:var(--muted); font-size:13px">${fmtDate(
                  a.CreatedAt,
                )}</div>
                <div style="margin-top:8px; white-space:pre-wrap">${a.Body}</div>
              </div>
            `,
            )
            .join("")
        : `<div class="feature">No announcements yet.</div>`;
    }
  } catch (err) {
    console.error("Error loading employee widgets:", err);
  }
}

// ---------------- CHECKLIST ----------------
async function loadChecklistPage() {
  console.log("Loading checklist page");

  const list = document.getElementById("checklistList");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const data = await api("/api/checklist");
    console.log("Checklist data:", data);

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
    console.error("Error loading checklist:", err);
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// ---------------- DOCUMENTS ----------------
async function loadMyDocuments() {
  console.log("Loading my documents");

  const tbody = document.getElementById("docsTbody");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const data = await api("/api/documents/my");
    console.log("Documents data:", data);

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
    console.error("Error loading documents:", err);
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

async function uploadDoc(e) {
  e.preventDefault();
  console.log("Upload document function called");

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
    console.error("Upload error:", err);
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// HR pending docs
async function loadPendingDocsHR() {
  console.log("Loading pending docs for HR");

  const tbody = document.getElementById("pendingTbody");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const data = await api("/api/hr/documents/pending");
    console.log("Pending docs data:", data);

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
    console.error("Error loading pending docs:", err);
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// ---------------- TRAININGS ----------------
async function loadTrainingsPage() {
  console.log("Loading trainings page");

  const tbody = document.getElementById("trainTbody");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const data = await api("/api/trainings");
    console.log("Trainings data:", data);

    if (!tbody) return;

    tbody.innerHTML = "";

    for (const t of data.trainings) {
      const tr = document.createElement("tr");
      const dt = new Date(t.StartsAt).toLocaleString();

      // check if training is in the past
      const isPast = new Date(t.StartsAt) < new Date();

      // determine button style based on status
      let buttonClass = "btn";
      let buttonText = "";
      let isDisabled = false;

      if (t.Attendance === "ATTENDED") {
        buttonClass = "btn-success";
        buttonText = "✓ Attended";
        isDisabled = true;
      } else if (t.Attendance === "UPCOMING" && isPast) {
        buttonClass = "btn-warning";
        buttonText = "⚠ Missed";
        isDisabled = true;
      } else if (t.Attendance === "UPCOMING" && !isPast) {
        buttonClass = "btn-primary";
        buttonText = "Mark Attended";
      }

      tr.innerHTML = `
        <td style="font-weight: 500;">${t.Title}</td>
        <td>
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 500;">${new Date(t.StartsAt).toLocaleDateString()}</span>
            <span style="color: var(--muted); font-size: 12px;">${new Date(t.StartsAt).toLocaleTimeString()}</span>
          </div>
        </td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 4px;">
            <span style="font-size: 16px;"></span>
            ${t.Location || "TBD"}
          </span>
        </td>
        <td>
          <span class="status-badge status-${t.Attendance.toLowerCase()}">
            ${t.Attendance}
          </span>
        </td>
        <td>
          <button class="btn ${buttonClass}" 
                  data-id="${t.TrainingId}"
                  ${isDisabled ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ""}>
            ${buttonText}
          </button>
        </td>
      `;

      // add event listener only if button is not disabled
      const btn = tr.querySelector("button");
      if (btn && !isDisabled && t.Attendance === "UPCOMING" && !isPast) {
        btn.addEventListener("click", async () => {
          // show confirmation dialog
          if (confirm(`Mark "${t.Title}" as attended?`)) {
            try {
              btn.textContent = "Updating...";
              btn.disabled = true;

              await api(`/api/trainings/${t.TrainingId}/attendance`, {
                method: "PATCH",
                body: JSON.stringify({ attendance: "ATTENDED" }),
              });

              // show success message
              showTemporaryMessage("Training marked as attended!", "success");
              loadTrainingsPage();
            } catch (err) {
              console.error("Error updating attendance:", err);
              showTemporaryMessage("Failed to update attendance", "error");
              btn.disabled = false;
              btn.textContent = "Mark Attended";
            }
          }
        });
      }

      tbody.appendChild(tr);
    }

    // if no trainings found
    if (data.trainings.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--muted);">
          <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No Trainings Found</div>
          <div style="font-size: 14px;">Check back later for scheduled training sessions.</div>
        </td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error("Error loading trainings:", err);
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// helper function to show temporary messages
function showTemporaryMessage(message, type = "info") {
  const msgDiv = document.getElementById("msg");
  if (!msgDiv) return;

  msgDiv.textContent = message;
  msgDiv.style.color =
    type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#2563eb";
  msgDiv.style.padding = "10px";
  msgDiv.style.borderRadius = "8px";
  msgDiv.style.backgroundColor =
    type === "success" ? "#d1fae5" : type === "error" ? "#fee2e2" : "#dbeafe";
  msgDiv.style.marginTop = "12px";
  msgDiv.style.transition = "opacity 0.5s";

  setTimeout(() => {
    msgDiv.style.opacity = "0";
    setTimeout(() => {
      msgDiv.textContent = "";
      msgDiv.style.opacity = "1";
      msgDiv.style.padding = "";
      msgDiv.style.backgroundColor = "";
    }, 500);
  }, 3000);
}

// ---------------- EQUIPMENT (employee) ----------------
async function loadMyEquipment() {
  console.log("Loading my equipment");

  const tbody = document.getElementById("equipTbody");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const data = await api("/api/equipment/my");
    console.log("Equipment data:", data);

    if (!tbody) return;

    tbody.innerHTML = "";
    for (const e of data.equipment) {
      const tr = document.createElement("tr");
      const assigned = new Date(e.AssignedAt).toLocaleString();
      const ack = e.EmployeeAck ? "Yes" : "No";

      tr.innerHTML = `
        <td>${e.ItemName}</td>
        <td>${e.SerialNumber || "-"}</td>
        <td>${e.Category || "-"}</td>
        <td>${assigned}</td>
        <td>${ack}</td>
        <td>
          ${
            e.ReturnedAt
              ? "<span class='badge'>Returned</span>"
              : e.EmployeeAck
                ? "<span class='badge'>Acknowledged</span>"
                : `<button class="btn btn-primary" data-id="${e.AssignmentId}">Acknowledge</button>`
          }
        </td>
      `;

      const btn = tr.querySelector("button");
      if (btn) {
        btn.addEventListener("click", async () => {
          await api(`/api/equipment/my/${btn.dataset.id}/ack`, {
            method: "PATCH",
          });
          loadMyEquipment();
        });
      }

      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error("Error loading equipment:", err);
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// ---------------- EQUIPMENT (HR) ----------------
async function loadHREquipmentPage() {
  console.log("Loading HR equipment page");

  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  await Promise.all([
    loadEmployeesForAssign(),
    loadEquipmentForAssign(),
    loadEquipmentAssignments(),
  ]);
}

async function loadEmployeesForAssign() {
  const sel = document.getElementById("empSelect");
  if (!sel) return;

  try {
    const data = await api("/api/hr/employees");
    console.log("Employees for assign:", data);

    sel.innerHTML = data.employees
      .map((u) => `<option value="${u.UserId}">${u.Name} (${u.Email})</option>`)
      .join("");
  } catch (err) {
    console.error("Error loading employees:", err);
  }
}

async function loadEquipmentForAssign() {
  const sel = document.getElementById("eqSelect");
  if (!sel) return;

  try {
    const data = await api("/api/hr/equipment");
    console.log("Equipment for assign:", data);

    const available = data.equipment.filter((x) => x.Status === "AVAILABLE");
    sel.innerHTML = available
      .map((e) => {
        const extra = [e.Category, e.SerialNumber].filter(Boolean).join(" • ");
        return `<option value="${e.EquipmentId}">${e.ItemName}${
          extra ? " (" + extra + ")" : ""
        }</option>`;
      })
      .join("");

    if (!available.length)
      sel.innerHTML = `<option value="">No AVAILABLE equipment</option>`;
  } catch (err) {
    console.error("Error loading equipment for assign:", err);
  }
}

async function loadEquipmentAssignments() {
  const tbody = document.getElementById("assignTbody");
  if (!tbody) return;

  try {
    const data = await api("/api/hr/equipment/assignments");
    console.log("Equipment assignments:", data);

    tbody.innerHTML = "";

    for (const a of data.assignments) {
      const tr = document.createElement("tr");
      const assigned = new Date(a.AssignedAt).toLocaleString();
      const returned = a.ReturnedAt
        ? new Date(a.ReturnedAt).toLocaleString()
        : "-";

      tr.innerHTML = `
        <td>${a.Name}</td>
        <td>${a.ItemName}</td>
        <td>${a.SerialNumber || "-"}</td>
        <td>${assigned}</td>
        <td>${a.EmployeeAck ? "Yes" : "No"}</td>
        <td>${returned}</td>
        <td>
          ${
            a.ReturnedAt
              ? "<span class='badge'>Done</span>"
              : `<button class="btn" data-id="${a.AssignmentId}">Mark Returned</button>`
          }
        </td>
      `;

      const btn = tr.querySelector("button");
      if (btn) {
        btn.addEventListener("click", async () => {
          await api(`/api/hr/equipment/assignments/${btn.dataset.id}/return`, {
            method: "PATCH",
          });
          loadHREquipmentPage();
        });
      }

      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error("Error loading assignments:", err);
  }
}

async function createEquipment(e) {
  e.preventDefault();
  console.log("Create equipment function called");

  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  const itemName = document.getElementById("eqName")?.value.trim();
  const serialNumber = document.getElementById("eqSerial")?.value.trim();
  const category = document.getElementById("eqCat")?.value.trim();

  try {
    await api("/api/hr/equipment", {
      method: "POST",
      body: JSON.stringify({ itemName, serialNumber, category }),
    });

    document.getElementById("eqName").value = "";
    document.getElementById("eqSerial").value = "";
    document.getElementById("eqCat").value = "";

    if (msg) {
      msg.textContent = "Equipment added";
      msg.style.color = "green";
    }

    loadHREquipmentPage();
  } catch (err) {
    console.error("Error creating equipment:", err);
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

async function assignEquipment(e) {
  e.preventDefault();
  console.log("Assign equipment function called");

  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  const userId = document.getElementById("empSelect")?.value;
  const equipmentId = document.getElementById("eqSelect")?.value;
  const dueBackAt = document.getElementById("dueBackAt")?.value;
  const notes = document.getElementById("eqNotes")?.value.trim();

  if (!equipmentId) {
    if (msg) {
      msg.textContent = "No available equipment to assign.";
      msg.style.color = "crimson";
    }
    return;
  }

  try {
    await api("/api/hr/equipment/assign", {
      method: "POST",
      body: JSON.stringify({
        userId,
        equipmentId,
        dueBackAt: dueBackAt || null,
        notes,
      }),
    });

    document.getElementById("eqNotes").value = "";
    if (msg) {
      msg.textContent = "Assigned";
      msg.style.color = "green";
    }

    loadHREquipmentPage();
  } catch (err) {
    console.error("Error assigning equipment:", err);
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// ---------------- ANNOUNCEMENTS + FAQ ----------------
async function loadAnnouncementsAndFaqs() {
  console.log("Loading announcements and FAQs");

  const announce = document.getElementById("announceList");
  const faq = document.getElementById("faqList");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const [a, f] = await Promise.all([
      api("/api/announcements"),
      api("/api/faqs"),
    ]);

    console.log("Announcements:", a);
    console.log("FAQs:", f);

    if (announce) {
      announce.innerHTML = a.announcements.length
        ? a.announcements
            .map(
              (x) => `
              <div class="feature">
                <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                  <div>
                    <div style="font-weight:900">${x.Title}</div>
                    <div style="color:var(--muted); font-size:13px">${new Date(
                      x.CreatedAt,
                    ).toLocaleString()} • ${x.Audience}</div>
                  </div>
                  <span class="badge">New</span>
                </div>
                <div style="margin-top:8px; white-space:pre-wrap">${x.Body}</div>
              </div>
            `,
            )
            .join("")
        : `<div class="feature">No announcements yet.</div>`;
    }

    if (faq) {
      faq.innerHTML = f.faqs.length
        ? f.faqs
            .map(
              (x) => `
              <details class="feature">
                <summary style="cursor:pointer; font-weight:900">${x.Question}</summary>
                <div style="margin-top:8px; white-space:pre-wrap">${x.Answer}</div>
                <div style="margin-top:8px; color:var(--muted); font-size:13px">${
                  x.Category || "General"
                }</div>
              </details>
            `,
            )
            .join("")
        : `<div class="feature">No FAQs yet.</div>`;
    }
  } catch (err) {
    console.error("Error loading announcements/FAQs:", err);
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// make functions globally available
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logout = logout;
window.loadDashboard = loadDashboard;
window.loadChecklistPage = loadChecklistPage;
window.loadMyDocuments = loadMyDocuments;
window.uploadDoc = uploadDoc;
window.loadPendingDocsHR = loadPendingDocsHR;
window.loadTrainingsPage = loadTrainingsPage;
window.createTraining = createTraining;
window.loadMyEquipment = loadMyEquipment;
window.loadHREquipmentPage = loadHREquipmentPage;
window.createEquipment = createEquipment;
window.assignEquipment = assignEquipment;
window.loadAnnouncementsAndFaqs = loadAnnouncementsAndFaqs;
