import apiClient from "./apiClient";
import type {
  ActionRegistryEntry,
  AuditActivityResult,
  AuditRange,
  AuditSessionEntry,
  AuditSummary,
  AuditUsageRow,
  AuditUserPageRow,
  BugReport,
  BugReportStatus,
} from "@/types/testing";

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

export const listPendingUsers = async (): Promise<PendingUser[]> => {
  const { data } = await apiClient.get<PendingUser[]>("/users", {
    params: { status: "pending" },
  });
  return data;
};

export const reviewUser = async (
  userId: string,
  status: "active" | "rejected"
): Promise<PendingUser> => {
  const { data } = await apiClient.patch<PendingUser>(`/users/${userId}`, { status });
  return data;
};

export const listAllUsers = async (): Promise<PendingUser[]> => {
  const { data } = await apiClient.get<PendingUser[]>("/users");
  return data;
};

export const createUser = async (input: {
  name: string;
  email: string;
  password: string;
  role: "source" | "testing" | "central-admin" | "admin";
}): Promise<PendingUser> => {
  const { data } = await apiClient.post<PendingUser>("/users", input);
  return data;
};

export const updateUserDetails = async (
  userId: string,
  input: { name?: string; email?: string; role?: "source" | "testing" | "central-admin" | "admin" }
): Promise<PendingUser> => {
  const { data } = await apiClient.patch<PendingUser>(`/users/${userId}`, input);
  return data;
};

export const setUserPassword = async (userId: string, newPassword: string) => {
  const { data } = await apiClient.patch(`/users/${userId}/password`, { newPassword });
  return data;
};

export const setUserRole = async (
  userId: string,
  role: "source" | "testing" | "central-admin" | "admin"
): Promise<PendingUser> => {
  const { data } = await apiClient.patch<PendingUser>(`/users/${userId}`, { role });
  return data;
};

export const deleteUser = async (userId: string): Promise<void> => {
  await apiClient.delete(`/users/${userId}`);
};

/** Admin-only (role === "admin"), matching Manage Users / Access Requests. */
export const listBugReports = async (status?: BugReportStatus): Promise<BugReport[]> => {
  const { data } = await apiClient.get<BugReport[]>("/bug-reports", {
    params: status ? { status } : undefined,
  });
  return data;
};

export const setBugReportStatus = async (id: string, status: BugReportStatus): Promise<BugReport> => {
  const { data } = await apiClient.patch<BugReport>(`/bug-reports/${id}`, { status });
  return data;
};

export const deleteBugReport = async (id: string): Promise<void> => {
  await apiClient.delete(`/bug-reports/${id}`);
};

/** Fetched as a blob (rather than a bare <a href>) so it can be opened in a
 * new tab without the screenshot's URL ever appearing in browser history. */
export const openBugReportScreenshot = async (id: string): Promise<void> => {
  const { data } = await apiClient.get(`/bug-reports/${id}/screenshot`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data as Blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ----- Audit Log (admin-only, same access level as the rest of this file) -----

export const getAuditSummary = async (): Promise<AuditSummary> => {
  const { data } = await apiClient.get<AuditSummary>("/audit-log/summary");
  return data;
};

export const getAuditUsage = async (range: AuditRange): Promise<AuditUsageRow[]> => {
  const { data } = await apiClient.get<AuditUsageRow[]>("/audit-log/usage", { params: { range } });
  return data;
};

export const getAuditSessions = async (range: AuditRange): Promise<AuditSessionEntry[]> => {
  const { data } = await apiClient.get<AuditSessionEntry[]>("/audit-log/sessions", {
    params: { range },
  });
  return data;
};

export const getAuditActivity = async (
  range: AuditRange,
  filters?: { search?: string; action?: "create" | "update" | "delete" }
): Promise<AuditActivityResult> => {
  const { data } = await apiClient.get<AuditActivityResult>("/audit-log/activity", {
    params: {
      range,
      ...(filters?.search ? { search: filters.search } : {}),
      ...(filters?.action ? { action: filters.action } : {}),
    },
  });
  return data;
};

/** Which pages one user visited within a range, and how often -- backs the
 * "click a user for the page breakdown" drill-down on Usage & Time. */
export const getAuditUserPages = async (userId: string, range: AuditRange): Promise<AuditUserPageRow[]> => {
  const { data } = await apiClient.get<AuditUserPageRow[]>(`/audit-log/usage/${userId}/pages`, {
    params: { range },
  });
  return data;
};

/** Admin / Central Admin only, matching who can Assign Retest. */
export const listActionRegistry = async (): Promise<ActionRegistryEntry[]> => {
  const { data } = await apiClient.get<ActionRegistryEntry[]>("/action-registry");
  return data;
};
