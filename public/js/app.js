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

    // load dashboard widgets
    if (roleExpected === "HR") {
      await loadHRDashboardWidgets();
    } else {
      await loadEmployeeDashboardWidgets();
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
  const tbody = document.getElementById("hrEmpTbody");
  const stats = document.getElementById("hrStats");
  const msg = document.getElementById("hrEmpMsg");

  if (!tbody && !stats) return;

  try {
    const data = await api("/api/hr/employees");
    const employees = data.employees || [];

    // top stats
    if (stats) {
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

    if (!tbody) return;
    tbody.innerHTML = "";

    // helper: format joined as 2 lines
    function fmtJoined(dt) {
      if (!dt) return { date: "-", time: "" };
      const d = new Date(dt);
      if (Number.isNaN(d.getTime())) return { date: "-", time: "" };
      return {
        date: d.toLocaleDateString(),
        time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
    }

    // helper: create "pill" without changing CSS
    function pill(text) {
      return `<span class="pill" style="padding:6px 10px; border-radius:999px; display:inline-block;">${text}</span>`;
    }

    for (const e of employees) {
      const total = Number(e.ChecklistTotal || 0);
      const done = Number(e.ChecklistDone || 0);
      const pct = total ? Math.round((done / total) * 100) : 0;

      const lastItem = e.LastItemName
        ? `${e.LastItemName}${e.LastSerialNumber ? ` • ${e.LastSerialNumber}` : ""}`
        : "-";

      const ackText = e.LastAssignedAt
        ? e.LastEmployeeAck
          ? "Yes"
          : "No"
        : "-";

      const joined = fmtJoined(e.CreatedAt);

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td style="padding:14px 16px; border-top:1px solid var(--border); vertical-align:top;">
          <div style="font-weight:900; line-height:1.2;">${e.Name}</div>
          <div style="color:var(--muted); font-size:13px; word-break:break-word;">${e.Email}</div>
        </td>

        <td style="padding:14px 16px; border-top:1px solid var(--border); vertical-align:top;">
          <div>${joined.date}</div>
          <div style="color:var(--muted); font-size:13px;">${joined.time}</div>
        </td>

        <td style="padding:14px 16px; border-top:1px solid var(--border); vertical-align:top;">
          <div style="font-weight:900;">${done}/${total}</div>
          <div style="color:var(--muted); font-size:13px;">${pct}%</div>
        </td>

        <td style="padding:14px 16px; border-top:1px solid var(--border); vertical-align:top;">
          ${pill(String(e.PendingDocs || 0))}
        </td>

        <td style="padding:14px 16px; border-top:1px solid var(--border); vertical-align:top;">
          ${pill(String(e.BorrowingNow || 0))}
        </td>

        <td style="padding:14px 16px; border-top:1px solid var(--border); vertical-align:top; word-break:break-word;">
          ${lastItem}
        </td>

        <td style="padding:14px 16px; border-top:1px solid var(--border); vertical-align:top;">
          ${fmtDate(e.LastAssignedAt)}
        </td>

        <td style="padding:14px 16px; border-top:1px solid var(--border); vertical-align:top;">
          ${fmtDate(e.LastReturnedAt)}
        </td>

        <td style="padding:14px 16px; border-top:1px solid var(--border); vertical-align:top;">
          ${pill(ackText)}
        </td>

        <td style="padding:14px 16px; border-top:1px solid var(--border); vertical-align:top;">
          <div style="display:flex; gap:8px; flex-wrap:wrap; white-space:nowrap;">
            <a class="btn btn-primary" href="/hr-equipment.html">Equipment</a>
            <a class="btn" href="/hr-documents.html">Docs</a>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    }

    if (msg) {
      msg.textContent = `Showing ${employees.length} employees.`;
      msg.style.color = "";
    }
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    } else {
      console.error(err);
    }
  }
}

async function loadEmployeeDashboardWidgets() {
  const stats = document.getElementById("empStats");
  const upcomingBox = document.getElementById("empUpcoming");
  const announceBox = document.getElementById("empAnnouncements");

  // checklist progress
  let checklist = { items: [] };
  try {
    checklist = await api("/api/checklist");
  } catch {}

  const items = checklist.items || [];
  const total = items.length;
  const done = items.filter((x) => x.Status === "DONE").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // docs
  let docs = { documents: [] };
  try {
    docs = await api("/api/documents/my");
  } catch {}
  const pendingDocs = (docs.documents || []).filter(
    (d) => d.Status === "PENDING",
  ).length;

  // equipment
  let equip = { equipment: [] };
  try {
    equip = await api("/api/equipment/my");
  } catch {}
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
    } catch {}

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
                <div style="color:var(--muted); font-size:13px">${fmtDate(t.StartsAt)} • ${t.Location || "-"}</div>
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
    } catch {}

    const top = (anns.announcements || []).slice(0, 2);
    announceBox.innerHTML = top.length
      ? top
          .map(
            (a) => `
            <div class="feature">
              <div style="font-weight:900">${a.Title}</div>
              <div style="color:var(--muted); font-size:13px">${fmtDate(a.CreatedAt)}</div>
              <div style="margin-top:8px; white-space:pre-wrap">${a.Body}</div>
            </div>
          `,
          )
          .join("")
      : `<div class="feature">No announcements yet.</div>`;
  }
}

// ---------------- HR HOME SECTIONS ----------------
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

async function loadEmployeeHomeSections() {
  const summaryGrid = document.getElementById("empSummaryGrid");
  const summaryMsg = document.getElementById("empSummaryMsg");

  const checklistPreview = document.getElementById("empChecklistPreview");
  const checklistMsg = document.getElementById("empChecklistMsg");

  const docsPreview = document.getElementById("empDocsPreview");
  const docsMsg = document.getElementById("empDocsMsg");

  const trainTbody = document.getElementById("empTrainPreviewTbody");
  const trainMsg = document.getElementById("empTrainMsg");

  const equipTbody = document.getElementById("empEquipPreviewTbody");
  const equipMsg = document.getElementById("empEquipMsg");

  if (
    !summaryGrid &&
    !checklistPreview &&
    !docsPreview &&
    !trainTbody &&
    !equipTbody
  )
    return;

  try {
    // load data in parallel
    const [check, docs, trains, equip] = await Promise.all([
      api("/api/checklist"),
      api("/api/documents/my"),
      api("/api/trainings"),
      api("/api/equipment/my"),
    ]);

    const items = check.items || [];
    const documents = docs.documents || [];
    const trainings = trains.trainings || [];
    const myEquip = equip.equipment || [];

    // -------- SUMMARY --------
    const doneCount = items.filter((x) => x.Status === "DONE").length;
    const pendingCount = items.length - doneCount;

    const docPending = documents.filter((d) => d.Status === "PENDING").length;
    const docApproved = documents.filter((d) => d.Status === "APPROVED").length;
    const docRejected = documents.filter((d) => d.Status === "REJECTED").length;

    const upcomingTrain = trainings.filter((t) => t.Attendance !== "ATTENDED");
    const borrowedNow = myEquip.filter((e) => !e.ReturnedAt).length;

    if (summaryGrid) {
      summaryGrid.innerHTML = `
        <div class="mock-item">
          <div>
            <div style="font-weight: 800">Checklist</div>
            <div style="color:#475569;font-size:13px">${doneCount} done / ${items.length} total</div>
          </div>
          <span class="badge">${pendingCount} pending</span>
        </div>

        <div class="mock-item">
          <div>
            <div style="font-weight: 800">Documents</div>
            <div style="color:#475569;font-size:13px">Pending / Approved / Rejected</div>
          </div>
          <span class="badge">${docPending} / ${docApproved} / ${docRejected}</span>
        </div>

        <div class="mock-item">
          <div>
            <div style="font-weight: 800">Training</div>
            <div style="color:#475569;font-size:13px">Upcoming sessions</div>
          </div>
          <span class="badge">${upcomingTrain.length}</span>
        </div>

        <div class="mock-item">
          <div>
            <div style="font-weight: 800">Equipment</div>
            <div style="color:#475569;font-size:13px">Borrowed now</div>
          </div>
          <span class="badge">${borrowedNow}</span>
        </div>
      `;
    }
    if (summaryMsg) summaryMsg.textContent = "";

    // -------- CHECKLIST PREVIEW --------
    if (checklistPreview) {
      const pending = items.filter((x) => x.Status !== "DONE").slice(0, 4);
      checklistPreview.innerHTML = "";

      for (const it of pending) {
        const div = document.createElement("div");
        div.className = "mock-item";
        div.innerHTML = `
          <div>
            <div style="font-weight:800">${it.Title}</div>
            <div style="color:#475569;font-size:13px">${it.Stage || ""}</div>
          </div>
          <span class="badge">${it.Status}</span>
        `;
        checklistPreview.appendChild(div);
      }

      if (!pending.length) {
        checklistPreview.innerHTML = `<div class="mock-item"><div><div style="font-weight:800">All checklist items done 🎉</div></div><span class="badge">DONE</span></div>`;
      }
      if (checklistMsg) checklistMsg.textContent = "";
    }

    // -------- DOCS PREVIEW --------
    if (docsPreview) {
      docsPreview.innerHTML = `
        <div class="mock-item">
          <div>
            <div style="font-weight:800">Pending</div>
            <div style="color:#475569;font-size:13px">Waiting HR review</div>
          </div>
          <span class="badge">${docPending}</span>
        </div>
        <div class="mock-item">
          <div>
            <div style="font-weight:800">Rejected</div>
            <div style="color:#475569;font-size:13px">Fix and re-upload</div>
          </div>
          <span class="badge">${docRejected}</span>
        </div>
      `;

      const recent = documents.slice(0, 2);
      for (const d of recent) {
        const div = document.createElement("div");
        div.className = "mock-item";
        div.innerHTML = `
          <div>
            <div style="font-weight:800">${d.DocType}</div>
            <div style="color:#475569;font-size:13px">${d.HRComment || "No comment"}</div>
          </div>
          <span class="badge">${d.Status}</span>
        `;
        docsPreview.appendChild(div);
      }

      if (!documents.length) {
        docsPreview.innerHTML += `<div class="mock-item"><div><div style="font-weight:800">No documents uploaded yet</div></div><span class="badge">0</span></div>`;
      }

      if (docsMsg) docsMsg.textContent = "";
    }

    // -------- TRAINING PREVIEW --------
    if (trainTbody) {
      trainTbody.innerHTML = "";

      for (const t of trainings.slice(0, 5)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${t.Title}</td>
          <td>${fmtDT(t.StartsAt)}</td>
          <td>${t.Location || "-"}</td>
          <td>${t.Attendance}</td>
        `;
        trainTbody.appendChild(tr);
      }

      if (!trainings.length) {
        trainTbody.innerHTML = `<tr><td colspan="4">No trainings assigned yet.</td></tr>`;
      }
      if (trainMsg) trainMsg.textContent = "";
    }

    // -------- EQUIPMENT PREVIEW --------
    if (equipTbody) {
      equipTbody.innerHTML = "";

      for (const e of myEquip.slice(0, 5)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${e.ItemName}</td>
          <td>${e.SerialNumber || "-"}</td>
          <td>${fmtDT(e.AssignedAt)}</td>
          <td>${e.EmployeeAck ? "Yes" : "No"}</td>
          <td>${e.ReturnedAt ? fmtDT(e.ReturnedAt) : "-"}</td>
        `;
        equipTbody.appendChild(tr);
      }

      if (!myEquip.length) {
        equipTbody.innerHTML = `<tr><td colspan="5">No equipment assigned yet.</td></tr>`;
      }
      if (equipMsg) equipMsg.textContent = "";
    }
  } catch (err) {
    const anyMsg =
      summaryMsg || checklistMsg || docsMsg || trainMsg || equipMsg;
    if (anyMsg) {
      anyMsg.textContent = err.message;
      anyMsg.style.color = "crimson";
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

    await loadHRHomeSections();
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// ---------------- EQUIPMENT (employee) ----------------
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

  const hrPanel = document.getElementById("hrAdminPanel");
  const hrAnnManage = document.getElementById("hrAnnManageList");
  const hrFaqManage = document.getElementById("hrFaqManageList");

  const empDashLink = document.getElementById("empDashLink");
  const hrDashLink = document.getElementById("hrDashLink");

  if (msg) msg.textContent = "";

  try {
    const me = await api("/api/me");
    const isHR = me.user.role === "HR";

    // role-based nav
    if (empDashLink) empDashLink.style.display = isHR ? "none" : "inline-flex";
    if (hrDashLink) hrDashLink.style.display = isHR ? "inline-flex" : "none";

    // public view
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
                    <div style="color:var(--muted); font-size:13px">
                      ${new Date(x.CreatedAt).toLocaleString()} • ${x.Audience}
                    </div>
                  </div>
                  <span class="badge">Live</span>
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

    // HR management view
    if (hrPanel) hrPanel.style.display = isHR ? "block" : "none";

    if (isHR) {
      const [allA, allF] = await Promise.all([
        api("/api/hr/announcements/all"),
        api("/api/hr/faqs/all"),
      ]);

      if (hrAnnManage) {
        hrAnnManage.innerHTML = (allA.announcements || []).length
          ? allA.announcements
              .map(
                (x) => `
                <div class="feature">
                  <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                    <div>
                      <div style="font-weight:900">${x.Title}</div>
                      <div style="color:var(--muted); font-size:13px">
                        ${new Date(x.CreatedAt).toLocaleString()} • ${x.Audience}
                      </div>
                    </div>
                    <button class="btn" onclick="deleteAnnouncement(${x.AnnouncementId})">Delete</button>
                  </div>
                  <div style="margin-top:8px; white-space:pre-wrap">${x.Body}</div>
                </div>
              `,
              )
              .join("")
          : `<div class="feature">No announcements created yet.</div>`;
      }

      if (hrFaqManage) {
        hrFaqManage.innerHTML = (allF.faqs || []).length
          ? allF.faqs
              .map((x) => {
                const status = x.IsActive ? "ACTIVE" : "INACTIVE";
                return `
                  <div class="feature">
                    <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                      <div>
                        <div style="font-weight:900">${x.Question}</div>
                        <div style="margin-top:6px; white-space:pre-wrap">${x.Answer}</div>
                        <div style="margin-top:8px; color:var(--muted); font-size:13px">
                          ${x.Category || "General"} • ${status}
                        </div>
                      </div>
                      ${
                        x.IsActive
                          ? `<button class="btn" onclick="deactivateFAQ(${x.FaqId})">Deactivate</button>`
                          : `<span class="badge">Done</span>`
                      }
                    </div>
                  </div>
                `;
              })
              .join("")
          : `<div class="feature">No FAQs created yet.</div>`;
      }
    }
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

// HR actions
async function createAnnouncement(e) {
  e.preventDefault();
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  const title = document.getElementById("aTitle")?.value.trim();
  const audience = document.getElementById("aAudience")?.value;
  const body = document.getElementById("aBody")?.value.trim();

  try {
    await api("/api/hr/announcements", {
      method: "POST",
      body: JSON.stringify({ title, body, audience }),
    });
    e.target.reset();
    if (msg) {
      msg.textContent = "Announcement posted!";
      msg.style.color = "green";
    }
    loadAnnouncementsAndFaqs();
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

async function deleteAnnouncement(id) {
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";
  try {
    await api(`/api/hr/announcements/${id}`, { method: "DELETE" });
    if (msg) {
      msg.textContent = "Deleted.";
      msg.style.color = "green";
    }
    loadAnnouncementsAndFaqs();
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

async function createFAQ(e) {
  e.preventDefault();
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  const question = document.getElementById("fQuestion")?.value.trim();
  const answer = document.getElementById("fAnswer")?.value.trim();
  const category = document.getElementById("fCategory")?.value.trim();

  try {
    await api("/api/hr/faqs", {
      method: "POST",
      body: JSON.stringify({ question, answer, category }),
    });
    e.target.reset();
    if (msg) {
      msg.textContent = "FAQ added!";
      msg.style.color = "green";
    }
    loadAnnouncementsAndFaqs();
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}

async function deactivateFAQ(id) {
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    await api(`/api/hr/faqs/${id}/deactivate`, { method: "PATCH" });
    if (msg) {
      msg.textContent = "FAQ deactivated.";
      msg.style.color = "green";
    }
    loadAnnouncementsAndFaqs();
  } catch (err) {
    if (msg) {
      msg.textContent = err.message;
      msg.style.color = "crimson";
    }
  }
}
