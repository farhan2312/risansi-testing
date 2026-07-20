/**
 * Shared helpers for the route handlers — JSON responses and snake_case row
 * serializers (matches the old function_app.py `_row_to_dict` convention the
 * frontend was already built against).
 */
import { NextResponse } from "next/server";

import type * as schema from "./db/schema";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400): NextResponse {
  return json({ error: message }, status);
}

type RequisitionRow = typeof schema.testRequisitions.$inferSelect;
type ReportRow = typeof schema.pumpTestReports.$inferSelect;
type PointRow = typeof schema.pumpTestReportPoints.$inferSelect;
type UserRow = typeof schema.users.$inferSelect;

/** Mirrors sales-portal-next's _user_to_dict(): raw snake_case columns, minus password_hash. */
export function userToDict(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    reviewed_by: u.reviewedBy,
    reviewed_at: u.reviewedAt,
    created_at: u.createdAt,
  };
}

export function requisitionToDict(r: RequisitionRow) {
  return {
    id: r.id,
    model: r.model,
    category: r.category,
    ec_quotation_no: r.ecQuotationNo,
    responsible_person: r.responsiblePerson,
    source_team: r.sourceTeam,
    date_of_receipt: r.dateOfReceipt,
    test_qty: r.testQty,
    qth: r.qth,
    power_hp: r.powerHp,
    power_kw: r.powerKw,
    head_kgcm2: r.headKgcm2,
    rpm: r.rpm,
    req_capacity: r.reqCapacity,
    observation: r.observation,
    ra_value: r.raValue,
    ve_rated_head: r.veRatedHead,
    me_rated_head: r.meRatedHead,
    measured_capacity: r.measuredCapacity,
    measured_head: r.measuredHead,
    measured_power: r.measuredPower,
    noise_jamming_other: r.noiseJammingOther,
    action: r.action,
    npsha: r.npsha,
    test_result: r.testResult,
    testing_plan_date: r.testingPlanDate,
    date_of_testing: r.dateOfTesting,
    retest_without_changing_die_pin: r.retestWithoutChangingDiePin,
    retest_needed: r.retestNeeded,
    die_pin_rework: r.diePinRework,
    status: r.status,
    general_remarks: r.generalRemarks,
    action_remarks: r.actionRemarks,
    created_by: r.createdBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    closed_at: r.closedAt,
  };
}

export function reportToDict(r: ReportRow) {
  return {
    id: r.id,
    requisition_id: r.requisitionId,
    model: r.model,
    gearbox_no: r.gearboxNo,
    gearbox_ratio: r.gearboxRatio,
    motor: r.motor,
    motor_rpm: r.motorRpm,
    suction_type: r.suctionType,
    liquid: r.liquid,
    rated_capacity: r.ratedCapacity,
    rated_head: r.ratedHead,
    specific_gravity: r.specificGravity,
    viscosity_cps: r.viscosityCps,
    k_for_given_cps: r.kForGivenCps,
    rated_rpm: r.ratedRpm,
    q_theoretical_100rev: r.qTheoretical100rev,
    calculated_head: r.calculatedHead,
    test_type: r.testType,
    npsha_status: r.npshaStatus,
    capacity_unit: r.capacityUnit,
    head_unit: r.headUnit,
    reference_voltage: r.referenceVoltage,
    reference_current: r.referenceCurrent,
    vnotch_baseline: r.vnotchBaseline,
    tested_by: r.testedBy,
    test_date: r.testDate,
    created_at: r.createdAt,
    report_format: r.reportFormat,
    po_no: r.poNo,
    ec_no: r.ecNo,
    rev_no: r.revNo,
    rev_date: r.revDate,
    pump_serial_no: r.pumpSerialNo,
  };
}

export function pointToDict(p: PointRow) {
  return {
    id: p.id,
    report_id: p.reportId,
    rpm: p.rpm,
    head_kgcm2: p.headKgcm2,
    head_mwc: p.headMwc,
    vnotch_height: p.vnotchHeight,
    initial_reading: p.initialReading,
    differential_height: p.differentialHeight,
    capacity_calculated_m3hr: p.capacityCalculatedM3hr,
    volts: p.volts,
    amps: p.amps,
    cos_phi: p.cosPhi,
    power_calculated_kw: p.powerCalculatedKw,
    theoretical_power_kw: p.theoreticalPowerKw,
    mechanical_efficiency: p.mechanicalEfficiency,
    theoretical_capacity_at_measured_rpm: p.theoreticalCapacityAtMeasuredRpm,
    slip_water: p.slipWater,
    slip_viscous: p.slipViscous,
    theoretical_capacity_at_rated_rpm: p.theoreticalCapacityAtRatedRpm,
    capacity_liquid_at_rated_rpm_m3hr: p.capacityLiquidAtRatedRpmM3hr,
    capacity_liquid_at_rated_rpm_lph: p.capacityLiquidAtRatedRpmLph,
    height_taken_for_filling: p.heightTakenForFilling,
    time_taken_to_fill_bucket_sec: p.timeTakenToFillBucketSec,
    volumetric_efficiency: p.volumetricEfficiency,
    volumetric_efficiency_liquid: p.volumetricEfficiencyLiquid,
    mechanical_efficiency_liquid: p.mechanicalEfficiencyLiquid,
  };
}
