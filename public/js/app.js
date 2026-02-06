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

  // set JSON header if NOT FormData
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
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

    // redirect based on role
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

    // ping correct route to prove role separation
    const pingPath =
      roleExpected === "HR" ? "/api/hr/ping" : "/api/employee/ping";
    const ping = await api(pingPath);

    if (status) {
      status.textContent = ping.message;
      status.style.color = "green";
    }

    // if HR dashboard has extra sections (pending docs preview + training preview), load them
    if (roleExpected === "HR") {
      await loadHRHomeSections();
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

// ---------------- HR HOME SECTIONS (NEW) ----------------
async function loadHRHomeSections() {
  const pendingTbody = document.getElementById("hrPendingPreviewTbody");
  const pendingMsg = document.getElementById("hrPendingPreviewMsg");

  const trainTbody = document.getElementById("hrTrainPreviewTbody");
  const trainMsg = document.getElementById("hrTrainPreviewMsg");

  if (!pendingTbody && !trainTbody) return;

  // pending documents preview
  if (pendingTbody) {
    try {
      if (pendingMsg) pendingMsg.textContent = "";

      const data = await api("/api/hr/documents/pending");
      const docs = data.documents || [];

      pendingTbody.innerHTML = "";

      for (const d of docs.slice(0, 5)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.Name}</td>
          <td>${d.DocType}</td>
          <td>${fmtDT(d.UploadedAt)}</td>
        `;
        pendingTbody.appendChild(tr);
      }

      if (!docs.length) {
        pendingTbody.innerHTML = `<tr><td colspan="3">No pending documents 🎉</td></tr>`;
      } else if (docs.length > 5 && pendingMsg) {
        pendingMsg.textContent = `Showing 5 of ${docs.length}. Open full review for all.`;
      }
    } catch (err) {
      if (pendingMsg) {
        pendingMsg.textContent = err.message;
        pendingMsg.style.color = "crimson";
      }
    }
  }

  // trainings preview (HR list)
  if (trainTbody) {
    try {
      if (trainMsg) trainMsg.textContent = "";

      // requires the new backend endpoint: GET /api/hr/trainings
      const data = await api("/api/hr/trainings");
      const trainings = data.trainings || [];

      trainTbody.innerHTML = "";

      for (const t of trainings.slice(0, 5)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${t.Title}</td>
          <td>${fmtDT(t.StartsAt)}</td>
          <td>${t.Location || "-"}</td>
        `;
        trainTbody.appendChild(tr);
      }

      if (!trainings.length) {
        trainTbody.innerHTML = `<tr><td colspan="3">No trainings created yet.</td></tr>`;
      }
    } catch (err) {
      if (trainMsg) {
        trainMsg.textContent = err.message;
        trainMsg.style.color = "crimson";
      }
    }
  }
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

    //refresh HR dashboard preview table if you're on hr.html
    await loadHRHomeSections();
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// ---------------- EQUIPMENT (Employee) ----------------
async function loadMyEquipment() {
  const tbody = document.getElementById("equipTbody");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const data = await api("/api/equipment/my");
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
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// ---------------- EQUIPMENT (HR) ----------------
async function loadHREquipmentPage() {
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
  const data = await api("/api/hr/employees");
  if (!sel) return;

  sel.innerHTML = data.employees
    .map((u) => `<option value="${u.UserId}">${u.Name} (${u.Email})</option>`)
    .join("");
}

async function loadEquipmentForAssign() {
  const sel = document.getElementById("eqSelect");
  const data = await api("/api/hr/equipment");
  if (!sel) return;

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
}

async function loadEquipmentAssignments() {
  const tbody = document.getElementById("assignTbody");
  if (!tbody) return;

  const data = await api("/api/hr/equipment/assignments");
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
}

async function createEquipment(e) {
  e.preventDefault();
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
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

async function assignEquipment(e) {
  e.preventDefault();
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
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// ---------------- ANNOUNCEMENTS + FAQ ----------------
async function loadAnnouncementsAndFaqs() {
  const announce = document.getElementById("announceList");
  const faq = document.getElementById("faqList");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    const [a, f] = await Promise.all([
      api("/api/announcements"),
      api("/api/faqs"),
    ]);

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
                <div style="margin-top:8px; color:var(--muted); font-size:13px">${x.Category || "General"}</div>
              </details>
            `,
            )
            .join("")
        : `<div class="feature">No FAQs yet.</div>`;
    }
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}
