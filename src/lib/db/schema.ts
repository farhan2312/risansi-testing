/**
 * Drizzle mapping of the shared Postgres schema for the testing portal.
 *
 * `users` mirrors sales-portal-next/src/lib/db/schema.ts exactly (read-only
 * here — that app owns migrations for it) since both apps share one `users`
 * table and JWT_SECRET, so a login in either app works in both.
 *
 * test_requisitions / pump_test_reports / pump_test_report_points are this
 * app's own tables — this app owns their migrations (drizzle-kit, see
 * package.json db:generate / db:migrate).
 */
import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).default("user"),
  status: varchar("status", { length: 20 }).default("pending"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

export const testRequisitions = pgTable("test_requisitions", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  model: varchar("model", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }),
  ecQuotationNo: varchar("ec_quotation_no", { length: 100 }),
  responsiblePerson: varchar("responsible_person", { length: 100 }),
  sourceTeam: varchar("source_team", { length: 50 }),
  dateOfReceipt: date("date_of_receipt"),
  testQty: integer("test_qty"),

  qth: numeric("qth", { precision: 10, scale: 4 }),
  powerHp: numeric("power_hp", { precision: 10, scale: 2 }),
  powerKw: numeric("power_kw", { precision: 10, scale: 4 }),
  headKgcm2: numeric("head_kgcm2", { precision: 10, scale: 2 }),
  rpm: numeric("rpm", { precision: 10, scale: 2 }),
  reqCapacity: numeric("req_capacity", { precision: 10, scale: 4 }),

  observation: text("observation"),
  raValue: numeric("ra_value", { precision: 10, scale: 4 }),
  veRatedHead: numeric("ve_rated_head", { precision: 6, scale: 2 }),
  meRatedHead: numeric("me_rated_head", { precision: 6, scale: 2 }),
  measuredCapacity: numeric("measured_capacity", { precision: 10, scale: 4 }),
  measuredHead: numeric("measured_head", { precision: 10, scale: 2 }),
  measuredPower: numeric("measured_power", { precision: 10, scale: 4 }),
  noiseJammingOther: text("noise_jamming_other"),
  action: text("action"),
  npsha: numeric("npsha", { precision: 10, scale: 4 }),
  testResult: varchar("test_result", { length: 20 }),

  testingPlanDate: date("testing_plan_date"),
  dateOfTesting: date("date_of_testing"),
  retestWithoutChangingDiePin: boolean("retest_without_changing_die_pin"),
  retestNeeded: boolean("retest_needed"),
  diePinRework: boolean("die_pin_rework"),
  status: varchar("status", { length: 30 }).default("Pending"),
  generalRemarks: text("general_remarks"),
  actionRemarks: text("action_remarks"),

  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(() => new Date()),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const pumpTestReports = pgTable("pump_test_reports", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  requisitionId: uuid("requisition_id"),

  // Human-readable sequential number, assigned via the DB sequence
  // pump_test_reports_report_no_seq at insert time (see reports/route.ts POST).
  reportNo: varchar("report_no", { length: 20 }),

  model: varchar("model", { length: 100 }).notNull(),
  gearboxNo: varchar("gearbox_no", { length: 255 }),
  gearboxRatio: varchar("gearbox_ratio", { length: 50 }),
  motor: varchar("motor", { length: 100 }),
  motorRpm: numeric("motor_rpm", { precision: 10, scale: 2 }),
  suctionType: varchar("suction_type", { length: 20 }),

  liquid: varchar("liquid", { length: 100 }).default("WATER"),
  ratedCapacity: numeric("rated_capacity", { precision: 10, scale: 4 }),
  ratedHead: numeric("rated_head", { precision: 10, scale: 2 }),
  specificGravity: numeric("specific_gravity", { precision: 6, scale: 3 }),
  viscosityCps: numeric("viscosity_cps", { precision: 10, scale: 2 }),
  kForGivenCps: numeric("k_for_given_cps", { precision: 10, scale: 4 }),
  ratedRpm: numeric("rated_rpm", { precision: 10, scale: 2 }),
  qTheoretical100rev: numeric("q_theoretical_100rev", { precision: 10, scale: 4 }),
  calculatedHead: numeric("calculated_head", { precision: 10, scale: 2 }),

  // New fields for the digital "OBSERVATION SHEET" format (NEW PUMP TESTING
  // FORMATE FOR DIGITAL): capacity measurement method, NPSHa reading, units,
  // and the reference/baseline readings (Vin/Iin/Hin) used by its formulas.
  testType: varchar("test_type", { length: 20 }), // 'Flow Meter' | 'Barrel' | 'V-notch'
  npshaStatus: varchar("npsha_status", { length: 20 }), // 'POSITIVE' | 'NEGATIVE'
  capacityUnit: varchar("capacity_unit", { length: 20 }),
  headUnit: varchar("head_unit", { length: 20 }),
  referenceVoltage: numeric("reference_voltage", { precision: 10, scale: 2 }), // Vin
  referenceCurrent: numeric("reference_current", { precision: 10, scale: 2 }), // Iin
  vnotchBaseline: numeric("vnotch_baseline", { precision: 10, scale: 2 }), // Hin

  testedBy: varchar("tested_by", { length: 100 }),
  testDate: date("test_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),

  // Which physical form this report was filled against — 'observation' (v-notch
  // sheet) or 'viscosity-chart' (UPDATE SHEET V-NOTCH (2)) — since they have
  // different header fields and calculations.
  reportFormat: varchar("report_format", { length: 30 }),

  // Header fields specific to the Viscosity Correction Chart format.
  poNo: varchar("po_no", { length: 100 }),
  ecNo: varchar("ec_no", { length: 100 }),
  revNo: varchar("rev_no", { length: 20 }),
  revDate: date("rev_date"),
  pumpSerialNo: varchar("pump_serial_no", { length: 100 }),

  // Vibration test + run summary footer block, Observation Sheet only.
  vibrationSoundDb: numeric("vibration_sound_db", { precision: 6, scale: 2 }),
  vibrationXMmSec: numeric("vibration_x_mm_sec", { precision: 6, scale: 2 }),
  vibrationYMmSec: numeric("vibration_y_mm_sec", { precision: 6, scale: 2 }),
  vibrationZMmSec: numeric("vibration_z_mm_sec", { precision: 6, scale: 2 }),
  pumpStartedAt: varchar("pump_started_at", { length: 20 }),
  pumpStoppedAt: varchar("pump_stopped_at", { length: 20 }),
  totalRun: varchar("total_run", { length: 20 }),
  ambientTempC: numeric("ambient_temp_c", { precision: 6, scale: 2 }),
  maxBearingTempC: numeric("max_bearing_temp_c", { precision: 6, scale: 2 }),
  totalRiseC: numeric("total_rise_c", { precision: 6, scale: 2 }),
  witness: varchar("witness", { length: 100 }),
  inspector: varchar("inspector", { length: 100 }),
  recorder: varchar("recorder", { length: 100 }),

  remarks: text("remarks"),
});

export const pumpTestReportPoints = pgTable("pump_test_report_points", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportId: uuid("report_id").notNull(),

  rpm: numeric("rpm", { precision: 10, scale: 2 }),
  headKgcm2: numeric("head_kgcm2", { precision: 10, scale: 2 }),
  headMwc: numeric("head_mwc", { precision: 10, scale: 2 }),
  vnotchHeight: numeric("vnotch_height", { precision: 10, scale: 4 }),
  initialReading: numeric("initial_reading", { precision: 10, scale: 4 }),
  differentialHeight: numeric("differential_height", { precision: 10, scale: 4 }),
  capacityCalculatedM3hr: numeric("capacity_calculated_m3hr", { precision: 10, scale: 4 }),
  volts: numeric("volts", { precision: 10, scale: 2 }),
  amps: numeric("amps", { precision: 10, scale: 2 }),
  cosPhi: numeric("cos_phi", { precision: 6, scale: 3 }),
  powerCalculatedKw: numeric("power_calculated_kw", { precision: 10, scale: 6 }),
  theoreticalPowerKw: numeric("theoretical_power_kw", { precision: 10, scale: 6 }),
  mechanicalEfficiency: numeric("mechanical_efficiency", { precision: 10, scale: 6 }),
  theoreticalCapacityAtMeasuredRpm: numeric("theoretical_capacity_at_measured_rpm", { precision: 10, scale: 4 }),
  slipWater: numeric("slip_water", { precision: 10, scale: 4 }),
  slipViscous: numeric("slip_viscous", { precision: 10, scale: 4 }),
  theoreticalCapacityAtRatedRpm: numeric("theoretical_capacity_at_rated_rpm", { precision: 10, scale: 4 }),
  capacityLiquidAtRatedRpmM3hr: numeric("capacity_liquid_at_rated_rpm_m3hr", { precision: 10, scale: 4 }),
  capacityLiquidAtRatedRpmLph: numeric("capacity_liquid_at_rated_rpm_lph", { precision: 10, scale: 2 }),

  // New fields for the digital format's raw inputs + volumetric efficiency.
  heightTakenForFilling: numeric("height_taken_for_filling", { precision: 10, scale: 2 }), // mm, V-notch/tank method
  timeTakenToFillBucketSec: numeric("time_taken_to_fill_bucket_sec", { precision: 10, scale: 2 }), // Barrel method
  volumetricEfficiency: numeric("volumetric_efficiency", { precision: 10, scale: 6 }), // VE % (water)

  // Viscosity Correction Chart format: liquid-corrected efficiencies (use
  // capacity-for-liquid-at-rated-rpm rather than raw measured capacity).
  volumetricEfficiencyLiquid: numeric("volumetric_efficiency_liquid", { precision: 10, scale: 6 }),
  mechanicalEfficiencyLiquid: numeric("mechanical_efficiency_liquid", { precision: 10, scale: 6 }),
});
