import apiClient from "./apiClient";
import { getToken } from "./session";
import type {
  ArchiveReportSummary,
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

const authHeader = () => ({
  headers: { Authorization: `Bearer ${getToken()}` },
});

export const listRequisitions = async (status?: RequisitionStatus): Promise<TestRequisition[]> => {
  const { data } = await apiClient.get<TestRequisition[]>("/requisitions", {
    ...authHeader(),
    params: status ? { status } : undefined,
  });
  return data;
};

export const getRequisition = async (id: string): Promise<TestRequisition> => {
  const { data } = await apiClient.get<TestRequisition>(`/requisitions/${id}`, authHeader());
  return data;
};

export const createRequisition = async (input: NewRequisitionInput): Promise<TestRequisition> => {
  const { data } = await apiClient.post<TestRequisition>("/requisitions", input, authHeader());
  return data;
};

export const updateRequisition = async (
  id: string,
  patch: Partial<TestRequisition>
): Promise<TestRequisition> => {
  const { data } = await apiClient.patch<TestRequisition>(`/requisitions/${id}`, patch, authHeader());
  return data;
};

export const listAttachments = async (requisitionId: string): Promise<RequisitionAttachment[]> => {
  const { data } = await apiClient.get<RequisitionAttachment[]>(
    `/requisitions/${requisitionId}/attachments`,
    authHeader()
  );
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
    { headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": undefined } }
  );
  return data;
};

export const deleteAttachment = async (requisitionId: string, attachmentId: string): Promise<void> => {
  await apiClient.delete(`/requisitions/${requisitionId}/attachments/${attachmentId}`, authHeader());
};

/** Opens an attachment in a new tab. Fetches it as a blob (with the auth
 * header) rather than a plain <a href> to the API route, since the JWT lives
 * in localStorage, not a cookie -- a bare link wouldn't carry it, and the
 * alternative (a token query param) would put a credential in the URL. */
export const openAttachment = async (requisitionId: string, attachmentId: string): Promise<void> => {
  const { data } = await apiClient.get(`/requisitions/${requisitionId}/attachments/${attachmentId}`, {
    ...authHeader(),
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
  const { data } = await apiClient.get<PumpDashboardData>(`/pumps/${encodeURIComponent(model)}`, authHeader());
  return data;
};

/** Portal-wide counts for the landing overview page. */
export const getOverview = async (): Promise<PortalOverview> => {
  const { data } = await apiClient.get<PortalOverview>("/overview", authHeader());
  return data;
};

export const submitReport = async (input: NewReportInput): Promise<PumpTestReport> => {
  const { data } = await apiClient.post<PumpTestReport>("/reports", input, authHeader());
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
  const { data } = await apiClient.patch<PumpTestReport>(`/reports/${id}`, input, authHeader());
  return data;
};

export const deleteReport = async (id: string): Promise<void> => {
  await apiClient.delete(`/reports/${id}`, authHeader());
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
