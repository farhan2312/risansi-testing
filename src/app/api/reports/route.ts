import { desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { error, json, pointToDict, reportToDict } from "@/lib/api";
import { db } from "@/lib/db";
import { pumpTestReportPoints, pumpTestReports, testRequisitions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const REPORT_FIELD_MAP: Record<string, string> = {
  gearbox_no: "gearboxNo",
  gearbox_ratio: "gearboxRatio",
  motor: "motor",
  motor_rpm: "motorRpm",
  suction_type: "suctionType",
  liquid: "liquid",
  rated_capacity: "ratedCapacity",
  rated_head: "ratedHead",
  specific_gravity: "specificGravity",
  viscosity_cps: "viscosityCps",
  k_for_given_cps: "kForGivenCps",
  rated_rpm: "ratedRpm",
  q_theoretical_100rev: "qTheoretical100rev",
  calculated_head: "calculatedHead",
  test_type: "testType",
  npsha_status: "npshaStatus",
  capacity_unit: "capacityUnit",
  head_unit: "headUnit",
  reference_voltage: "referenceVoltage",
  reference_current: "referenceCurrent",
  vnotch_baseline: "vnotchBaseline",
  tested_by: "testedBy",
  test_date: "testDate",
};

const POINT_FIELD_MAP: Record<string, string> = {
  rpm: "rpm",
  head_kgcm2: "headKgcm2",
  head_mwc: "headMwc",
  vnotch_height: "vnotchHeight",
  initial_reading: "initialReading",
  differential_height: "differentialHeight",
  capacity_calculated_m3hr: "capacityCalculatedM3hr",
  volts: "volts",
  amps: "amps",
  cos_phi: "cosPhi",
  power_calculated_kw: "powerCalculatedKw",
  theoretical_power_kw: "theoreticalPowerKw",
  mechanical_efficiency: "mechanicalEfficiency",
  theoretical_capacity_at_measured_rpm: "theoreticalCapacityAtMeasuredRpm",
  slip_water: "slipWater",
  slip_viscous: "slipViscous",
  theoretical_capacity_at_rated_rpm: "theoreticalCapacityAtRatedRpm",
  capacity_liquid_at_rated_rpm_m3hr: "capacityLiquidAtRatedRpmM3hr",
  capacity_liquid_at_rated_rpm_lph: "capacityLiquidAtRatedRpmLph",
  height_taken_for_filling: "heightTakenForFilling",
  time_taken_to_fill_bucket_sec: "timeTakenToFillBucketSec",
  volumetric_efficiency: "volumetricEfficiency",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const model = searchParams.get("model");
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 500);

  const reports = model
    ? await db.select().from(pumpTestReports).where(ilike(pumpTestReports.model, `%${model}%`)).orderBy(desc(pumpTestReports.createdAt)).limit(limit)
    : await db.select().from(pumpTestReports).orderBy(desc(pumpTestReports.createdAt)).limit(limit);

  const reportIds = reports.map((r) => r.id);
  const counts = reportIds.length
    ? await db
        .select({ reportId: pumpTestReportPoints.reportId, count: sql<number>`count(*)::int` })
        .from(pumpTestReportPoints)
        .where(inArray(pumpTestReportPoints.reportId, reportIds))
        .groupBy(pumpTestReportPoints.reportId)
    : [];
  const countByReport = new Map(counts.map((c) => [c.reportId, c.count]));

  return json(
    reports.map((r) => ({ ...reportToDict(r), pointCount: countByReport.get(r.id) ?? 0 }))
  );
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const model = body.model;
  if (!model) {
    return error("'model' is required", 400);
  }

  const requisitionId = body.requisitionId ? String(body.requisitionId) : null;
  if (requisitionId) {
    const [requisition] = await db.select().from(testRequisitions).where(eq(testRequisitions.id, requisitionId)).limit(1);
    if (!requisition) {
      return error("Requisition not found", 404);
    }
  }

  const reportValues: Record<string, unknown> = { model, requisitionId };
  for (const [snakeKey, camelKey] of Object.entries(REPORT_FIELD_MAP)) {
    if (body[snakeKey] !== undefined && body[snakeKey] !== "") {
      reportValues[camelKey] = body[snakeKey];
    }
  }

  const [report] = await db
    .insert(pumpTestReports)
    .values(reportValues as typeof pumpTestReports.$inferInsert)
    .returning();

  const rawPoints = Array.isArray(body.points) ? (body.points as Record<string, unknown>[]) : [];
  const pointRows = rawPoints.map((point) => {
    const values: Record<string, unknown> = { reportId: report.id };
    for (const [snakeKey, camelKey] of Object.entries(POINT_FIELD_MAP)) {
      if (point[snakeKey] !== undefined) {
        values[camelKey] = point[snakeKey];
      }
    }
    return values as typeof pumpTestReportPoints.$inferInsert;
  });

  const insertedPoints = pointRows.length
    ? await db.insert(pumpTestReportPoints).values(pointRows).returning()
    : [];

  if (requisitionId) {
    await db
      .update(testRequisitions)
      .set({ status: "Closed", closedAt: new Date(), updatedAt: new Date() })
      .where(eq(testRequisitions.id, requisitionId));
  }

  return json(
    {
      ...reportToDict(report),
      points: insertedPoints.map(pointToDict),
    },
    201
  );
}
