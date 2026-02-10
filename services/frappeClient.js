const BASE = process.env.FRAPPE_BASE_URL;
const KEY = process.env.FRAPPE_API_KEY;
const SECRET = process.env.FRAPPE_API_SECRET;

function frappeHeaders() {
  if (!BASE || !KEY || !SECRET) {
    throw new Error(
      "Missing FRAPPE env vars (FRAPPE_BASE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET)",
    );
  }
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `token ${KEY}:${SECRET}`,
  };
}

async function frappeRequest(path, { method = "GET", body } = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: frappeHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.exc || "Frappe request failed";
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function listDocType(doctype, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  return frappeRequest(
    `/api/resource/${encodeURIComponent(doctype)}?${qs.toString()}`,
  );
}

function getDoc(doctype, name) {
  return frappeRequest(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
  );
}

function createDoc(doctype, doc) {
  return frappeRequest(`/api/resource/${encodeURIComponent(doctype)}`, {
    method: "POST",
    body: doc,
  });
}

function updateDoc(doctype, name, fields) {
  return frappeRequest(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: fields,
    },
  );
}

function deleteDoc(doctype, name) {
  return frappeRequest(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
    },
  );
}

module.exports = {
  frappeRequest,
  listDocType,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
};
