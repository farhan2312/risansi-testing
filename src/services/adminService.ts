import apiClient from "./apiClient";
import { getToken } from "./session";
import type { BugReport, BugReportStatus } from "@/types/testing";

export interface PendingUser {
  id: string;
  email: string;
  name: string | null;
  role: "source" | "testing" | "central-admin" | "admin";
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
  role: "source" | "testing" | "central-admin" | "admin"
): Promise<PendingUser> => {
  const { data } = await apiClient.patch<PendingUser>(`/users/${userId}`, { role }, authHeader());
  return data;
};

export const deleteUser = async (userId: string): Promise<void> => {
  await apiClient.delete(`/users/${userId}`, authHeader());
};

/** Admin-only (role === "admin"), matching Manage Users / Access Requests. */
export const listBugReports = async (status?: BugReportStatus): Promise<BugReport[]> => {
  const { data } = await apiClient.get<BugReport[]>("/bug-reports", {
    ...authHeader(),
    params: status ? { status } : undefined,
  });
  return data;
};

export const setBugReportStatus = async (id: string, status: BugReportStatus): Promise<BugReport> => {
  const { data } = await apiClient.patch<BugReport>(`/bug-reports/${id}`, { status }, authHeader());
  return data;
};

export const deleteBugReport = async (id: string): Promise<void> => {
  await apiClient.delete(`/bug-reports/${id}`, authHeader());
};

/** Same auth-safe blob-open pattern as openAttachment in testingService.ts —
 * the JWT lives in localStorage, not a cookie, so a bare <a href> wouldn't
 * carry it. */
export const openBugReportScreenshot = async (id: string): Promise<void> => {
  const { data } = await apiClient.get(`/bug-reports/${id}/screenshot`, {
    ...authHeader(),
    responseType: "blob",
  });
  const url = URL.createObjectURL(data as Blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
