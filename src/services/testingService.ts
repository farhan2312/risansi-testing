import apiClient from "./apiClient";
import type {
  ArchiveReportSummary,
  DedupCheckResult,
  NewReportInput,
  NewRequisitionInput,
  PumpTestReport,
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

export const dedupCheck = async (model: string): Promise<DedupCheckResult> => {
  const { data } = await apiClient.get<DedupCheckResult>("/requisitions/dedup-check", {
    params: { model },
  });
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
