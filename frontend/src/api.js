//helper module for making HTTP requests
//attaches JWT token to every request

import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000", //  FastAPI backend URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
