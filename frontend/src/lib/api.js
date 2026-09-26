/**
 * Small fetch wrapper for the Django API.
 * Adds the login token, refreshes it once when it expires, and turns
 * error responses into readable messages.
 */
const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "");

const tokens = {
  get access() { return localStorage.getItem("vc_access"); },
  get refresh() { return localStorage.getItem("vc_refresh"); },
  set({ access, refresh }) {
    if (access) localStorage.setItem("vc_access", access);
    if (refresh) localStorage.setItem("vc_refresh", refresh);
  },
  clear() {
    localStorage.removeItem("vc_access");
    localStorage.removeItem("vc_refresh");
  },
};
export { tokens };

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/* Pull the first human-readable message out of a DRF error response */
function messageFrom(data, status) {
  if (!data) return status >= 500 ? "Something went wrong on our side. Please try again." : "Request failed.";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  for (const value of Object.values(data)) {
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    if (typeof value === "string") return value;
  }
  return "Please check the form and try again.";
}

async function refreshAccess() {
  if (!tokens.refresh) return false;
  const res = await fetch(`${BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: tokens.refresh }),
  });
  if (!res.ok) {
    tokens.clear();
    return false;
  }
  tokens.set(await res.json());
  return true;
}

export async function api(path, { method = "GET", body, auth = true, retry = true } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the store right now. Check your connection and try again.", 0);
  }

  if (res.status === 401 && auth && retry && tokens.refresh && (await refreshAccess())) {
    return api(path, { method, body, auth, retry: false });
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status, data);
  return data;
}
