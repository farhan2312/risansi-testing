import axios from "axios";

// Same-origin Next.js route handlers under /api — no CORS needed.
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

export default apiClient;
