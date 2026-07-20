// Field names are snake_case to match the Next.js API route responses
// (src/lib/api.ts serializers, mirroring the old function_app.py convention).

export type RequisitionStatus = "Pending" | "In Testing" | "Retest Needed" | "Closed";

export const REQUISITION_CATEGORIES = [
  "Against Pump Testing Project",
  "Against New Die Pin",
  "Against Quotation Test",
  "Against R&D Trials",
  "Against EC Based",
] as const;

export const SOURCE_TEAMS = ["Sales", "Planning", "Research", "Higher Management"] as const;

export const TEST_TYPES = ["V-notch", "Barrel", "Flow Meter"] as const;
export type TestType = (typeof TEST_TYPES)[number];

export const NPSHA_STATUSES = ["POSITIVE", "NEGATIVE"] as const;

export const CAPACITY_UNITS = ["M3/HR", "MT/HR", "LPH", "KG/MIN", "TPH"] as const;
export const HEAD_UNITS = ["MWC", "MLC", "KG/CM2", "MTR", "TPH"] as const;

// Viscosity Correction Chart form has its own (slightly different) unit lists.
export const VISCOSITY_CAPACITY_UNITS = ["M3/HR", "LPH", "TPH", "MT/HR", "KG"] as const;
export const VISCOSITY_HEAD_UNITS = ["MWC", "MLC", "KG/CM2", "METER"] as const;

export const REPORT_FORMATS = ["observation", "viscosity-chart"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export interface TestRequisition {
  id: string;
  model: string;
  category: string | null;
  ec_quotation_no: string | null;
  responsible_person: string | null;
  source_team: string | null;
  date_of_receipt: string | null;
  test_qty: number | null;

  qth: number | null;
  power_hp: number | null;
  power_kw: number | null;
  head_kgcm2: number | null;
  rpm: number | null;
  req_capacity: number | null;

  observation: string | null;
  ra_value: number | null;
  ve_rated_head: number | null;
  me_rated_head: number | null;
  measured_capacity: number | null;
  measured_head: number | null;
  measured_power: number | null;
  noise_jamming_other: string | null;
  action: string | null;
  npsha: number | null;
  test_result: "Positive" | "Negative" | null;

  testing_plan_date: string | null;
  date_of_testing: string | null;
  retest_without_changing_die_pin: boolean | null;
  retest_needed: boolean | null;
  die_pin_rework: boolean | null;
  status: RequisitionStatus;
  general_remarks: string | null;
  action_remarks: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;

  reports?: PumpTestReport[];
  report_id?: string | null;
}

export interface NewRequisitionInput {
  model: string;
  category: string;
  ec_quotation_no?: string;
  responsible_person: string;
  source_team: string;
  date_of_receipt?: string;
  test_qty?: number;
  qth?: number;
  power_hp?: number;
  power_kw?: number;
  head_kgcm2?: number;
  rpm?: number;
  req_capacity?: number;
}

export interface PumpTestReportPoint {
  id?: string;
  rpm: number | null;
  head_kgcm2: number | null;
  head_mwc: number | null;
  vnotch_height: number | null;
  initial_reading: number | null;
  differential_height: number | null;
  capacity_calculated_m3hr: number | null;
  volts: number | null;
  amps: number | null;
  cos_phi: number | null;
  power_calculated_kw: number | null;
  theoretical_power_kw: number | null;
  mechanical_efficiency: number | null;
  theoretical_capacity_at_measured_rpm: number | null;
  slip_water: number | null;
  slip_viscous: number | null;
  theoretical_capacity_at_rated_rpm: number | null;
  capacity_liquid_at_rated_rpm_m3hr: number | null;
  capacity_liquid_at_rated_rpm_lph: number | null;
  // Digital-format additions
  height_taken_for_filling: number | null;
  time_taken_to_fill_bucket_sec: number | null;
  volumetric_efficiency: number | null;
  // Viscosity Correction Chart additions
  volumetric_efficiency_liquid: number | null;
  mechanical_efficiency_liquid: number | null;
}

export interface PumpTestReport {
  id: string;
  requisition_id: string | null;
  model: string;
  gearbox_no: string | null;
  gearbox_ratio: string | null;
  motor: string | null;
  motor_rpm: number | null;
  suction_type: string | null;
  liquid: string | null;
  rated_capacity: number | null;
  rated_head: number | null;
  specific_gravity: number | null;
  viscosity_cps: number | null;
  k_for_given_cps: number | null;
  rated_rpm: number | null;
  q_theoretical_100rev: number | null;
  calculated_head: number | null;
  // Digital-format additions
  test_type: TestType | null;
  npsha_status: string | null;
  capacity_unit: string | null;
  head_unit: string | null;
  reference_voltage: number | null;
  reference_current: number | null;
  vnotch_baseline: number | null;
  tested_by: string | null;
  test_date: string | null;
  created_at: string;
  // Format tag + Viscosity Correction Chart header fields
  report_format: ReportFormat | null;
  po_no: string | null;
  ec_no: string | null;
  rev_no: string | null;
  rev_date: string | null;
  pump_serial_no: string | null;
  points: PumpTestReportPoint[];
}

export interface NewReportInput {
  requisitionId?: string;
  model: string;
  gearbox_no?: string;
  gearbox_ratio?: string;
  motor?: string;
  motor_rpm?: number;
  suction_type?: string;
  liquid?: string;
  rated_capacity?: number;
  rated_head?: number;
  specific_gravity?: number;
  viscosity_cps?: number;
  k_for_given_cps?: number;
  rated_rpm?: number;
  q_theoretical_100rev?: number;
  calculated_head?: number;
  test_type?: string;
  npsha_status?: string;
  capacity_unit?: string;
  head_unit?: string;
  reference_voltage?: number;
  reference_current?: number;
  vnotch_baseline?: number;
  tested_by?: string;
  test_date?: string;
  report_format?: ReportFormat;
  po_no?: string;
  ec_no?: string;
  rev_no?: string;
  rev_date?: string;
  pump_serial_no?: string;
  points: Omit<PumpTestReportPoint, "id">[];
}

export interface ArchiveReportSummary extends Omit<PumpTestReport, "points"> {
  pointCount: number;
}

export interface DedupCheckResult {
  model: string;
  priorReports: PumpTestReport[];
  alreadyTested: boolean;
}
