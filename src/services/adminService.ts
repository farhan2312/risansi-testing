import apiClient from "./apiClient";
import { getToken } from "./session";

export interface PendingUser {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "source" | "testing" | "admin";
  status: "pending" | "active" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const authHeader = () => ({
  headers: { Authorization: `Bearer ${getToken()}` },
});

export const listPendingUsers = async (): Promise<PendingUser[]> => {
  const { data } = await apiClient.get<PendingUser[]>("/users", {
    ...authHeader(),
    params: { status: "pending" },
  });
  return data;
};

export const reviewUser = async (
  userId: string,
  status: "active" | "rejected"
): Promise<PendingUser> => {
  const { data } = await apiClient.patch<PendingUser>(
    `/users/${userId}`,
    { status },
    authHeader()
  );
  return data;
};

export const listAllUsers = async (): Promise<PendingUser[]> => {
  const { data } = await apiClient.get<PendingUser[]>("/users", authHeader());
  return data;
};

export const setUserPassword = async (userId: string, newPassword: string) => {
  const { data } = await apiClient.patch(
    `/users/${userId}/password`,
    { newPassword },
    authHeader()
  );
  return data;
};

export const setUserRole = async (
  userId: string,
  role: "source" | "testing" | "admin"
): Promise<PendingUser> => {
  const { data } = await apiClient.patch<PendingUser>(`/users/${userId}`, { role }, authHeader());
  return data;
};
