import { eq, inArray } from "drizzle-orm";

import { error, json, pointToDict, reportToDict, requisitionToDict } from "@/lib/api";
import { db } from "@/lib/db";
import { pumpTestReportPoints, pumpTestReports, testRequisitions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const PATCH_FIELD_MAP: Record<string, string> = {
  category: "category",
  ec_quotation_no: "ecQuotationNo",
  responsible_person: "responsiblePerson",
  source_team: "sourceTeam",
  date_of_receipt: "dateOfReceipt",
  test_qty: "testQty",
  qth: "qth",
  power_hp: "powerHp",
  power_kw: "powerKw",
  head_kgcm2: "headKgcm2",
  rpm: "rpm",
  req_capacity: "reqCapacity",
  observation: "observation",
  ra_value: "raValue",
  ve_rated_head: "veRatedHead",
  me_rated_head: "meRatedHead",
  measured_capacity: "measuredCapacity",
  measured_head: "measuredHead",
  measured_power: "measuredPower",
  noise_jamming_other: "noiseJammingOther",
  action: "action",
  npsha: "npsha",
  test_result: "testResult",
  testing_plan_date: "testingPlanDate",
  date_of_testing: "dateOfTesting",
  retest_without_changing_die_pin: "retestWithoutChangingDiePin",
  retest_needed: "retestNeeded",
  die_pin_rework: "diePinRework",
  status: "status",
  general_remarks: "generalRemarks",
  action_remarks: "actionRemarks",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [requisition] = await db.select().from(testRequisitions).where(eq(testRequisitions.id, id)).limit(1);
  if (!requisition) {
    return error("Requisition not found", 404);
  }

  const reports = await db.select().from(pumpTestReports).where(eq(pumpTestReports.requisitionId, id));

  const reportIds = reports.map((r) => r.id);
  const points = reportIds.length
    ? await db.select().from(pumpTestReportPoints).where(inArray(pumpTestReportPoints.reportId, reportIds))
    : [];
  const pointsByReport = new Map<string, typeof points>();
  for (const p of points) {
    const list = pointsByReport.get(p.reportId) ?? [];
    list.push(p);
    pointsByReport.set(p.reportId, list);
  }

  return json({
    ...requisitionToDict(requisition),
    reports: reports.map((r) => ({
      ...reportToDict(r),
      points: (pointsByReport.get(r.id) ?? []).map(pointToDict),
    })),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const values: Record<string, unknown> = {};
  for (const [snakeKey, camelKey] of Object.entries(PATCH_FIELD_MAP)) {
    if (body[snakeKey] !== undefined) {
      values[camelKey] = body[snakeKey];
    }
  }
  values.updatedAt = new Date();
  if (body.status === "Closed") {
    values.closedAt = new Date();
  }

  const [requisition] = await db
    .update(testRequisitions)
    .set(values as Partial<typeof testRequisitions.$inferInsert>)
    .where(eq(testRequisitions.id, id))
    .returning();

  if (!requisition) {
    return error("Requisition not found", 404);
  }

  return json(requisitionToDict(requisition));
}
