import axios from "axios";

// Helper to prevent baked-in 'localhost' from overriding EC2 IP
const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl;
  }
  return `http://${window.location.hostname}:5000/api`;
};

const API = axios.create({
  baseURL: getBaseURL(),
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;