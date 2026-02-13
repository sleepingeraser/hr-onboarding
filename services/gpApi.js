const crypto = require("crypto");

const GP_API_BASE = process.env.GP_API_BASE || "https://api.g-p.com/api";
const GP_API_TOKEN = process.env.GP_API_TOKEN || "";
const GP_API_MOCK =
  String(process.env.GP_API_MOCK || "").toLowerCase() === "true";

function mockEmployees() {
  return {
    requestData: { customerId: "cust_mock_123" },
    employees: [
      {
        employeeId: "wh-mock-001",
        firstName: "Alicia",
        lastName: "Tan",
        status: "ACTIVE",
        personalEmail: "alicia.tan@example.com",
      },
      {
        employeeId: "wh-mock-002",
        firstName: "Ben",
        lastName: "Lim",
        status: "NEW",
        personalEmail: "ben.lim@example.com",
      },
    ],
    page: { limit: 50, nextCursor: null, prevCursor: null },
    _mock: true,
  };
}

async function listEmployees({ limit = 50, cursor = null } = {}) {
  // if no token, or mock forced → return mock
  if (GP_API_MOCK || !GP_API_TOKEN.trim()) {
    return mockEmployees();
  }

  const url = new URL(`${GP_API_BASE}/v1/employees`);
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);

  const reqId = crypto.randomUUID();
  const corrId = crypto.randomUUID();

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${GP_API_TOKEN}`,
      Accept: "application/json",
      "X-Request-ID": reqId,
      "X-Correlation-ID": corrId,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.message ||
      `G-P API request failed (${res.status}). Check token / permissions.`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = data;
    throw err;
  }

  return data;
}

module.exports = { listEmployees };
