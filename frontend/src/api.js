//helper module for making HTTP requests
//attaches JWT token to every request

import axios from "axios";

const api = axios.create({
  // Override with VITE_API_URL in frontend/.env for non-local deployments.
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  timeout: 12000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// When the token expires, log out cleanly instead of failing every request.
// 401s from the login form itself are bad credentials, not an expired session.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isLoginRequest = error.config?.url?.includes("/login");
    if (status === 401 && !isLoginRequest) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("email");
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
