import apiClient from "./apiClient";
import { getToken } from "./session";

export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  role: "source" | "testing" | "central-admin" | "admin";
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

// Shares the `users` table with the sales portal — an account created here
// (or approved here) works in both apps, same credentials.
export const login = async (email: string, password: string): Promise<LoginResult> => {
  const { data } = await apiClient.post<LoginResult>("/auth/login", { email, password });
  return data;
};

export const requestAccess = async (name: string, email: string, password: string) => {
  const { data } = await apiClient.post("/access-requests", { name, email, password });
  return data;
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const { data } = await apiClient.post(
    "/auth/change-password",
    { currentPassword, newPassword },
    { headers: { Authorization: `Bearer ${getToken()}` } },
  );
  return data;
};
