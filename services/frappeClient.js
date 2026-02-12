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

async function frappeRequest(path, { method = "GET", body, params = {} } = {}) {
  const url = new URL(`${BASE}${path}`);

  // add query parameters
  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key]),
  );

  const res = await fetch(url.toString(), {
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

// docType CRUD operations
function listDocType(doctype, params = {}) {
  return frappeRequest(`/api/resource/${encodeURIComponent(doctype)}`, {
    params,
  });
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

// file upload
async function uploadFile(file, doctype, docname, fieldname = "file") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doctype", doctype);
  formData.append("docname", docname);
  formData.append("fieldname", fieldname);

  const url = `${BASE}/api/method/upload_file`;
  const headers = {
    Authorization: `token ${KEY}:${SECRET}`,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "File upload failed");
  return data;
}

// custom method calls
async function callMethod(method, params = {}, body = null) {
  const url = `/api/method/${method}`;
  return frappeRequest(url, {
    method: body ? "POST" : "GET",
    params,
    body,
  });
}

module.exports = {
  frappeRequest,
  listDocType,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  uploadFile,
  callMethod,
};
