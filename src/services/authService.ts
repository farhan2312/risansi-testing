import apiClient from "./apiClient";

export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

// Shares the `users` table with the sales portal — a tester's account is
// created via the sales portal's request-access flow (same admin approval),
// and the same credentials work in both apps.
export const login = async (email: string, password: string): Promise<LoginResult> => {
  const { data } = await apiClient.post<LoginResult>("/auth/login", { email, password });
  return data;
};
