const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const TOKEN_KEY = "greenhouse_auth_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(errorBody.message || "API request failed");
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

function createEntityStore(name) {
  const encodedName = encodeURIComponent(name);

  return {
    async list(sortBy, limit) {
      const params = new URLSearchParams();
      if (sortBy) params.set("sortBy", sortBy);
      if (typeof limit === "number") params.set("limit", String(limit));

      const query = params.toString();
      return request(`/api/${encodedName}${query ? `?${query}` : ""}`);
    },
    async create(data) {
      return request(`/api/${encodedName}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async update(id, patch) {
      return request(`/api/${encodedName}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    async delete(id) {
      return request(`/api/${encodedName}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
  };
}

export const appClient = {
  auth: {
    async login(credentials) {
      const result = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      setToken(result.token);
      return result.user;
    },
    async me() {
      return request("/auth/me");
    },
    async logout() {
      try {
        return await request("/auth/logout", { method: "POST" });
      } finally {
        clearToken();
      }
    },
  },
  entities: {
    SensorData: createEntityStore("SensorData"),
    DeviceState: createEntityStore("DeviceState"),
    AutomationRule: createEntityStore("AutomationRule"),
    Alert: createEntityStore("Alert"),
  },
};
