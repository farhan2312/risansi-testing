import apiClient from "./apiClient";
import { getToken } from "./session";
import type {
  ArchiveReportSummary,
  DedupCheckResult,
  NewReportInput,
  NewRequisitionInput,
  PumpTestReport,
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
  const { data } = await apiClient.patch<TestRequisition>(`/requisitions/${id}`, patch);
  return data;
};

export const dedupCheck = async (model: string): Promise<DedupCheckResult> => {
  const { data } = await apiClient.get<DedupCheckResult>("/requisitions/dedup-check", {
    params: { model },
  });
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
  const { data } = await apiClient.patch<PumpTestReport>(`/reports/${id}`, input);
  return data;
};

export const deleteReport = async (id: string): Promise<void> => {
  await apiClient.delete(`/reports/${id}`);
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
