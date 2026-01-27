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

// simple fetch wrapper
async function api(path, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// auth flows
async function registerUser(e) {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  const msg = document.getElementById("msg");
  msg.textContent = "";

  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role }),
    });
    msg.textContent = "Registered! Please log in.";
    msg.style.color = "green";
    setTimeout(() => (window.location.href = "/login.html"), 700);
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = "crimson";
  }
}

async function loginUser(e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const msg = document.getElementById("msg");
  msg.textContent = "";

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
    msg.textContent = err.message;
    msg.style.color = "crimson";
  }
}

async function loadDashboard(roleExpected) {
  const status = document.getElementById("status");
  const who = document.getElementById("who");

  try {
    const me = await api("/api/me");
    who.textContent = `${me.user.name} (${me.user.role})`;

    if (me.user.role !== roleExpected) {
      status.textContent = "Access denied: wrong role.";
      status.style.color = "crimson";
      return;
    }

    // ping role route to prove backend separation
    const pingPath =
      roleExpected === "HR" ? "/api/hr/ping" : "/api/employee/ping";
    const ping = await api(pingPath);
    status.textContent = ping.message;
    status.style.color = "green";
  } catch (err) {
    status.textContent = "Please log in again.";
    status.style.color = "crimson";
    clearToken();
    setTimeout(() => (window.location.href = "/login.html"), 800);
  }
}

function logout() {
  clearToken();
  window.location.href = "/index.html";
}
