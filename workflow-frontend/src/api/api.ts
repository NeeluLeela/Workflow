import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/",
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  const tenantId = localStorage.getItem("tenantId");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    config.headers["X-Tenant-Id"] = tenantId;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("tenantId");
      window.location.href = "/login";
    }
    if (
      error.response?.status === 422 &&
      error.response?.data?.message?.includes("X-Tenant-Id")
    ) {
      localStorage.removeItem("tenantId");
      window.location.href = "/select-tenant";
    }
    return Promise.reject(error);
  }
);

export default api;