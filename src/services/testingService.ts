import apiClient from "./apiClient";
import type {
  ActionRegistryEntry,
  ArchiveReportSummary,
  BugReport,
  BugReportSeverity,
  BugReportType,
  DedupCheckResult,
  NewReportInput,
  NewRequisitionInput,
  PortalOverview,
  PumpDashboardData,
  PumpTestReport,
  RequisitionAttachment,
  RequisitionStatus,
  TestRequisition,
} from "../types/testing";

export const listRequisitions = async (status?: RequisitionStatus): Promise<TestRequisition[]> => {
  const { data } = await apiClient.get<TestRequisition[]>("/requisitions", {
    params: status ? { status } : undefined,
  });
  return data;
};

export const getRequisition = async (id: string): Promise<TestRequisition> => {
  const { data } = await apiClient.get<TestRequisition>(`/requisitions/${id}`);
  return data;
};

export const createRequisition = async (input: NewRequisitionInput): Promise<TestRequisition> => {
  const { data } = await apiClient.post<TestRequisition>("/requisitions", input);
  return data;
};

export const updateRequisition = async (
  id: string,
  patch: Partial<TestRequisition>
): Promise<TestRequisition> => {
  const { data } = await apiClient.patch<TestRequisition>(`/requisitions/${id}`, patch);
  return data;
};

export const listAttachments = async (requisitionId: string): Promise<RequisitionAttachment[]> => {
  const { data } = await apiClient.get<RequisitionAttachment[]>(`/requisitions/${requisitionId}/attachments`);
  return data;
};

export const uploadAttachment = async (
  requisitionId: string,
  file: File
): Promise<RequisitionAttachment> => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<RequisitionAttachment>(
    `/requisitions/${requisitionId}/attachments`,
    form,
    // Content-Type: undefined overrides apiClient's default "application/json"
    // so the browser sets multipart/form-data with the correct boundary itself.
    { headers: { "Content-Type": undefined } }
  );
  return data;
};

export const deleteAttachment = async (requisitionId: string, attachmentId: string): Promise<void> => {
  await apiClient.delete(`/requisitions/${requisitionId}/attachments/${attachmentId}`);
};

/** Opens an attachment in a new tab. Fetches it as a blob rather than a
 * plain <a href> to the API route so the object URL (not the API route
 * itself) is what ends up in browser history/tab. */
export const openAttachment = async (requisitionId: string, attachmentId: string): Promise<void> => {
  const { data } = await apiClient.get(`/requisitions/${requisitionId}/attachments/${attachmentId}`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data as Blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const dedupCheck = async (model: string): Promise<DedupCheckResult> => {
  const { data } = await apiClient.get<DedupCheckResult>("/requisitions/dedup-check", {
    params: { model },
  });
  return data;
};

/** Quick-pick model suggestions for the requisition Model dropdown. */
export const listPumpModels = async (): Promise<string[]> => {
  const { data } = await apiClient.get<string[]>("/pump-models");
  return data;
};

/** Every requisition and report for one physical pump, matched by model. */
export const getPumpDashboard = async (model: string): Promise<PumpDashboardData> => {
  const { data } = await apiClient.get<PumpDashboardData>(`/pumps/${encodeURIComponent(model)}`);
  return data;
};

/** Portal-wide counts for the landing overview page. Optional from/to
 * ("YYYY-MM-DD") narrows every count to that window -- omit both for the
 * all-time snapshot. */
export const getOverview = async (range?: { from?: string; to?: string }): Promise<PortalOverview> => {
  const { data } = await apiClient.get<PortalOverview>("/overview", { params: range });
  return data;
};

export const submitReport = async (input: NewReportInput): Promise<PumpTestReport> => {
  const { data } = await apiClient.post<PumpTestReport>("/reports", input);
  return data;
};

export const listReports = async (model?: string): Promise<ArchiveReportSummary[]> => {
  const { data } = await apiClient.get<ArchiveReportSummary[]>("/reports", {
    params: { limit: 500, ...(model ? { model } : {}) },
  });
  return data;
};

export const getReport = async (id: string): Promise<PumpTestReport> => {
  const { data } = await apiClient.get<PumpTestReport>(`/reports/${id}`);
  return data;
};

export const updateReport = async (
  id: string,
  input: Omit<NewReportInput, "requisitionId">
): Promise<PumpTestReport> => {
  const { data } = await apiClient.patch<PumpTestReport>(`/reports/${id}`, input);
  return data;
};

export const deleteReport = async (id: string): Promise<void> => {
  await apiClient.delete(`/reports/${id}`);
};

export interface AssignRetestResult {
  requisition: TestRequisition;
  action_registry_entry: ActionRegistryEntry;
}

/** Raises a fresh Pending requisition for this report's model, Retest Needed
 * pre-set, and records an Action Registry entry (unmet fields, rated/
 * measured snapshot, the given action points) -- Admin / Central Admin
 * only. */
export const assignRetest = async (reportId: string, actionPoints: string[] = []): Promise<AssignRetestResult> => {
  const { data } = await apiClient.post<AssignRetestResult>(`/reports/${reportId}/assign-retest`, {
    action_points: actionPoints,
  });
  return data;
};

/** Latest Observation Sheet report submitted for this exact pump model, if
 * any — used to prefill the Viscosity Correction Chart form for the same pump. */
export const getLatestObservationReport = async (model: string): Promise<ArchiveReportSummary | null> => {
  const trimmed = model.trim();
  if (!trimmed) return null;
  const rows = await listReports(trimmed);
  const matches = rows
    .filter((r) => r.model.toLowerCase() === trimmed.toLowerCase())
    .filter((r) => (r.report_format ?? "observation") === "observation")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return matches[0] ?? null;
};

export interface NewBugReportInput {
  type: BugReportType;
  title: string;
  description?: string;
  severity: BugReportSeverity;
  page?: string;
  screenshot?: File;
}

/** Available to every logged-in user regardless of role. */
export const submitBugReport = async (input: NewBugReportInput): Promise<BugReport> => {
  const form = new FormData();
  form.append("type", input.type);
  form.append("title", input.title);
  if (input.description) form.append("description", input.description);
  form.append("severity", input.severity);
  if (input.page) form.append("page", input.page);
  if (input.screenshot) form.append("screenshot", input.screenshot);
  const { data } = await apiClient.post<BugReport>("/bug-reports", form, {
    headers: { "Content-Type": undefined },
  });
  return data;
};
