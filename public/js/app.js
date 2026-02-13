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
  const headers = options.headers ? { ...options.headers } : {};

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const isFormData = options.body instanceof FormData;

  // set JSON header if NOT FormData and no Content-Type already set
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      // add credentials to ensure cookies are sent if needed
      credentials: "same-origin",
    });

    // check if response is ok before parsing JSON
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Request failed with status ${res.status}`,
      );
    }

    const data = await res.json().catch(() => ({}));
    return data;
  } catch (err) {
    console.error("API call failed:", err);
    throw err;
  }
}
