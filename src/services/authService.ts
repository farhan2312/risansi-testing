import apiClient from "./apiClient";
import { getToken } from "./session";

export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  role: "source" | "testing" | "central-admin" | "admin";
  must_change_password: boolean;
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

export const requestAccess = async (name: string, email: string, password: string, role: string) => {
  const { data } = await apiClient.post("/access-requests", { name, email, password, role });
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

/** Closes the audit-log session server-side before the token is cleared
 * client-side -- best-effort, sign-out proceeds either way. */
export const logout = async (): Promise<void> => {
  try {
    await apiClient.post("/auth/logout", {}, { headers: { Authorization: `Bearer ${getToken()}` } });
  } catch {
    // Sign-out proceeds regardless -- this is just closing the audit trail.
  }
};
