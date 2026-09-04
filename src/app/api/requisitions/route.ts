import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { error, json, requisitionToDict } from "@/lib/api";
import { getClientIp, logAudit } from "@/lib/audit";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { pumpTestReportPoints, pumpTestReports, testRequisitions, users } from "@/lib/db/schema";
import { computeRequirementStatus, unmetRequirementLabels } from "@/lib/requirementCheck";

export const dynamic = "force-dynamic";

const CAMEL_BY_SNAKE = {
  model: "model",
  category: "category",
  ec_quotation_no: "ecQuotationNo",
  offer_date: "offerDate",
  responsible_person: "responsiblePerson",
  source_team: "sourceTeam",
  date_of_requisition: "dateOfRequisition",
  test_qty: "testQty",
  qth: "qth",
  specific_gravity: "specificGravity",
  power_hp: "powerHp",
  power_kw: "powerKw",
  head_kgcm2: "headKgcm2",
  head_unit: "headUnit",
  rpm: "rpm",
  motor_rpm: "motorRpm",
  req_capacity: "reqCapacity",
  req_capacity_unit: "reqCapacityUnit",
  media_type: "mediaType",
  target_date: "targetDate",
  general_remarks: "generalRemarks",
};

export async function GET(req: Request) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const conditions = [];
  if (status) conditions.push(eq(testRequisitions.status, status));
  // Source teams only see the requisitions they personally raised — testing
  // team and admins still see everything, since they process all of them.
  if (claims.role === "source") conditions.push(eq(testRequisitions.createdBy, claims.sub));

  const rows = conditions.length
    ? await db.select().from(testRequisitions).where(and(...conditions)).orderBy(desc(testRequisitions.createdAt))
    : await db.select().from(testRequisitions).orderBy(desc(testRequisitions.createdAt));

  const requisitionIds = rows.map((r) => r.id);
  const reports = requisitionIds.length
    ? await db
        .select({
          id: pumpTestReports.id,
          requisitionId: pumpTestReports.requisitionId,
          ratedHead: pumpTestReports.ratedHead,
          ratedCapacity: pumpTestReports.ratedCapacity,
          ratedPowerKw: pumpTestReports.ratedPowerKw,
        })
        .from(pumpTestReports)
        .where(inArray(pumpTestReports.requisitionId, requisitionIds))
    : [];
  const reportIdByRequisition = new Map(reports.map((r) => [r.requisitionId, r.id]));

  // Did the linked report reach its rated head/capacity/power? Only the max
  // across its points matters for that check, so aggregate in SQL rather
  // than shipping every point down just to compute this in the list view.
  const reportIds = reports.map((r) => r.id);
  const maxes = reportIds.length
    ? await db
        .select({
          reportId: pumpTestReportPoints.reportId,
          maxHead: sql<string | null>`max(${pumpTestReportPoints.headKgcm2})`,
          maxCapacity: sql<string | null>`max(${pumpTestReportPoints.capacityCalculatedM3hr})`,
          maxPower: sql<string | null>`max(${pumpTestReportPoints.powerCalculatedKw})`,
        })
        .from(pumpTestReportPoints)
        .where(inArray(pumpTestReportPoints.reportId, reportIds))
        .groupBy(pumpTestReportPoints.reportId)
    : [];
  const maxByReport = new Map(maxes.map((m) => [m.reportId, m]));

  const unmetByRequisition = new Map(
    reports.map((r) => {
      const max = maxByReport.get(r.id);
      const status = computeRequirementStatus(
        {
          rated_head: r.ratedHead === null ? null : Number(r.ratedHead),
          rated_capacity: r.ratedCapacity === null ? null : Number(r.ratedCapacity),
          rated_power_kw: r.ratedPowerKw === null ? null : Number(r.ratedPowerKw),
        },
        max
          ? [
              {
                head_kgcm2: max.maxHead === null ? null : Number(max.maxHead),
                capacity_calculated_m3hr: max.maxCapacity === null ? null : Number(max.maxCapacity),
                power_calculated_kw: max.maxPower === null ? null : Number(max.maxPower),
              },
            ]
          : []
      );
      return [r.requisitionId, unmetRequirementLabels(status)];
    })
  );

  return json(
    rows.map((r) => ({
      ...requisitionToDict(r),
      report_id: reportIdByRequisition.get(r.id) ?? null,
      report_requirement_unmet_fields: unmetByRequisition.get(r.id) ?? [],
    }))
  );
}

export async function POST(req: Request) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  if (!body.model) {
    return error("'model' is required", 400);
  }

  const values: Record<string, unknown> = {};
  for (const [snakeKey, camelKey] of Object.entries(CAMEL_BY_SNAKE)) {
    if (body[snakeKey] !== undefined && body[snakeKey] !== "") {
      values[camelKey] = body[snakeKey];
    }
  }

  // "Submitted By" is always the logged-in creator, resolved server-side —
  // never trusted from the request body.
  const [creator] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);
  const submittedBy = creator?.name ?? claims.email;

  const [requisition] = await db
    .insert(testRequisitions)
    .values({
      ...values,
      status: "Pending",
      createdBy: claims.sub,
      submittedBy,
    } as typeof testRequisitions.$inferInsert)
    .returning();

  await logAudit({
    ipAddress: getClientIp(req),
    userId: claims.sub,
    userName: submittedBy,
    userEmail: claims.email,
    eventType: "create",
    entityType: "requisition",
    entityId: requisition.id,
    entityLabel: requisition.model,
  });

  return json(requisitionToDict(requisition), 201);
}
