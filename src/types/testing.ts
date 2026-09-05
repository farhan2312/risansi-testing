// Field names are snake_case to match the Next.js API route responses
// (src/lib/api.ts serializers, mirroring the old function_app.py convention).

export type RequisitionStatus = "Pending" | "In Testing" | "Retest Needed" | "Closed";

export const REQUISITION_CATEGORIES = [
  "Against Pump Testing Project",
  "Against New Die Pin",
  "Against Die Pin Rework",
  "Against Quotation Test",
  "Against R&D Trials",
  "Against EC Based",
] as const;

/** Label for the EC/Quotation/Offer No. field, tailored to the requisition category. */
export const ecQuotationLabel = (category?: string | null): string => {
  if (category === "Against EC Based") return "EC No.";
  if (category === "Against Quotation Test") return "Quotation No.";
  return "EC/Quotation/Offer No.";
};

/** RIL's standard EC/quotation-number schemes, shown as a format hint under
 * the field for the categories that have one -- undefined (no hint) for
 * every other category. */
export const ecQuotationFormatHint = (category?: string | null): string | undefined => {
  if (category === "Against Quotation Test") return "RIL/QT/TSM CODING/CATEGORY OF ITEM/OFFER";
  if (category === "Against EC Based") return "EC/YEAR/1/So No./EC No.";
  return undefined;
};

export const SOURCE_TEAMS = ["Research", "Proposal", "Testing"] as const;

export const RESPONSIBLE_PERSONS = ["Sachin", "Vikas"] as const;

// The two standard motor synchronous speeds used across every requisition
// and report form -- Motor RPM is a fixed-choice field, not free text.
export const MOTOR_RPM_OPTIONS = ["1440", "960"] as const;

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
  /** Human-readable sequential number ("REQ-000123") -- shown in the URL
   * and UI instead of id. */
  requisition_no: string | null;
  model: string;
  category: string | null;
  ec_quotation_no: string | null;
  offer_date: string | null;
  responsible_person: string | null;
  source_team: string | null;
  date_of_requisition: string | null;
  test_qty: number | null;

  qth: number | null;
  specific_gravity: number | null;
  power_hp: number | null;
  power_kw: number | null;
  head_kgcm2: number | null;
  head_unit: string | null;
  rpm: number | null;
  motor_rpm: number | null;
  req_capacity: number | null;
  req_capacity_unit: string | null;

  // Only shown/filled on the requisition form when Category is "Against
  // R&D Trials" -- general_remarks (below) doubles as "Open Remarks" there.
  media_type: string | null;
  target_date: string | null;

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
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;

  reports?: PumpTestReport[];
  report_id?: string | null;
  /** The linked report's human-readable number ("TR-000159") -- use this,
   * not report_id, when linking to /reports/[id]. */
  report_no?: string | null;
  /** Which rated fields (Head/Capacity/Power) the linked report's test
   * points never reached -- empty when met or there's no report yet. */
  report_requirement_unmet_fields?: string[];
  attachments?: RequisitionAttachment[];
}

/** Metadata only -- file_data is never sent down with the list, only via the
 * dedicated download endpoint (GET .../attachments/[attachmentId]). */
export interface RequisitionAttachment {
  id: string;
  requisition_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface NewRequisitionInput {
  model: string;
  category: string;
  ec_quotation_no?: string;
  offer_date?: string;
  responsible_person: string;
  source_team: string;
  date_of_requisition?: string;
  test_qty?: number;
  qth?: number;
  specific_gravity?: number;
  power_hp?: number;
  power_kw?: number;
  head_kgcm2?: number;
  head_unit?: string;
  rpm?: number;
  motor_rpm?: number;
  req_capacity?: number;
  req_capacity_unit?: string;
  media_type?: string;
  target_date?: string;
  general_remarks?: string;
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
  /** The linked requisition's human-readable number ("REQ-000123") -- only
   * present where the route actually joins for it (report detail, pump
   * dashboard); use this, not requisition_id, when linking to it. */
  requisition_no?: string | null;
  report_no: string | null;
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
  rated_power_kw: number | null;
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

  // Vibration test + run summary footer block, Observation Sheet only.
  vibration_sound_db: number | null;
  vibration_x_mm_sec: number | null;
  vibration_y_mm_sec: number | null;
  vibration_z_mm_sec: number | null;
  pump_started_at: string | null;
  pump_stopped_at: string | null;
  total_run: string | null;
  ambient_temp_c: number | null;
  max_bearing_temp_c: number | null;
  total_rise_c: number | null;
  witness: string | null;
  inspector: string | null;
  recorder: string | null;

  remarks: string | null;
  prepared_by: string | null;

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
  rated_power_kw?: number;
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
  vibration_sound_db?: number;
  vibration_x_mm_sec?: number;
  vibration_y_mm_sec?: number;
  vibration_z_mm_sec?: number;
  pump_started_at?: string;
  pump_stopped_at?: string;
  total_run?: string;
  ambient_temp_c?: number;
  max_bearing_temp_c?: number;
  total_rise_c?: number;
  witness?: string;
  inspector?: string;
  recorder?: string;
  remarks?: string;
  points: Omit<PumpTestReportPoint, "id">[];
}

export interface ArchiveReportSummary extends Omit<PumpTestReport, "points"> {
  pointCount: number;
  /** Which rated fields (Head/Capacity/Power) the report's own test points
   * never reached -- empty when met or when there's nothing to compare. */
  requirement_unmet_fields: string[];
  /** Highest Volumetric/Mechanical Efficiency reached across this report's
   * own test points -- null when there's no VE/ME data to max over. */
  max_ve: number | null;
  max_me: number | null;
  /** Every test point's own head/capacity/power, in the same order across
   * all three arrays (sorted by head ascending, same convention the report
   * detail page's Test Data table uses) -- backs the Pump Dashboard's
   * expanded "rated vs every measured point" columns. */
  points_head_kgcm2: (number | null)[];
  points_capacity_m3hr: (number | null)[];
  points_power_kw: (number | null)[];
}

export interface DedupCheckResult {
  model: string;
  priorReports: PumpTestReport[];
  alreadyTested: boolean;
}

export interface PumpDashboardData {
  model: string;
  requisitions: TestRequisition[];
  reports: PumpTestReport[];
}

/** Portal-wide counts for the landing overview page -- see /api/overview. */
export interface PortalOverview {
  total_requisitions: number;
  requisitions_by_status: Partial<Record<RequisitionStatus, number>>;
  total_reports: number;
  reports_by_format: Partial<Record<ReportFormat, number>>;
  total_test_points: number;
  /** Distinct pump models raised for testing OR actually tested -- same
   * normalized-key count as the Pump Dashboard's "Pump Models" tile. */
  distinct_models_tested: number;
  requirement_met: number;
  requirement_unmet: number;
}

export type BugReportType = "bug" | "feature";
export type BugReportSeverity = "Low" | "Medium" | "High" | "Critical";
export type BugReportStatus = "Open" | "In Progress" | "Resolved";

/** Metadata only -- screenshot bytes are never sent down with the list, only
 * via the dedicated GET .../bug-reports/[id]/screenshot endpoint. */
export interface BugReport {
  id: string;
  type: BugReportType;
  title: string;
  description: string | null;
  severity: BugReportSeverity;
  page: string | null;
  status: BugReportStatus;
  screenshot_file_name: string | null;
  screenshot_mime_type: string | null;
  screenshot_file_size: number | null;
  has_screenshot: boolean;
  reported_by: string | null;
  reported_by_name: string | null;
  created_at: string;
}

// ----- Audit Log (admin-only) -----

export type AuditRange = "today" | "7days" | "30days" | "all";

export interface AuditSummary {
  logins_24h: number;
  failed_24h: number;
  active_users_24h: number;
  actions_24h: number;
}

export interface AuditUsageRow {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  /** Null when the account has since been deleted -- role comes from a live
   * join against users, not a snapshot. */
  user_role: string | null;
  session_count: number;
  /** Seconds -- format for display, don't reformat server-side. */
  active_seconds: number;
  page_count: number;
  last_active: string;
}

/** Per-page breakdown for one user within a range -- backs the "click a
 * user for the page breakdown" drill-down on Usage & Time. */
export interface AuditUserPageRow {
  path: string;
  view_count: number;
  last_viewed: string;
}

export interface AuditSessionEntry {
  id: string;
  user_name: string | null;
  user_email: string | null;
  event_type: "login" | "login_failed" | "logout";
  details: string | null;
  created_at: string;
}

export interface AuditActivityEntry {
  id: string;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  event_type: "create" | "update" | "delete";
  entity_type: string | null;
  entity_id: string | null;
  /** The entity's human-readable number (requisition_no/report_no) when
   * entity_type is "requisition"/"report" -- use this, not entity_id, when
   * linking to it. Null for every other entity type, or when the id no
   * longer resolves to anything (the row was since deleted). */
  entity_no: string | null;
  entity_label: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditActivityResult {
  entries: AuditActivityEntry[];
  total: number;
}

// ----- Action Registry (Admin / Central Admin only) -----

/** One "Assign Retest" -- a durable rated-vs-measured snapshot of why a
 * retest was raised, plus any action points the assigner typed in. See
 * /api/reports/[id]/assign-retest. */
export interface ActionRegistryEntry {
  id: string;
  requisition_id: string;
  /** The requisition's human-readable number ("REQ-000123") -- use this, not
   * requisition_id, when linking to it. */
  requisition_no: string | null;
  report_id: string;
  model: string;
  report_no: string | null;
  /** e.g. "Head, Power" */
  unmet_fields: string;
  rated_head: number | null;
  measured_head: number | null;
  rated_capacity: number | null;
  measured_capacity: number | null;
  rated_power_kw: number | null;
  measured_power_kw: number | null;
  action_points: string[];
  assigned_by: string | null;
  assigned_by_name: string | null;
  originally_raised_by: string | null;
  created_at: string;
}
