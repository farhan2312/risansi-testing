import { desc, eq, inArray } from "drizzle-orm";

import { attachmentToDict, error, json, pointToDict, reportToDict, requisitionToDict } from "@/lib/api";
import { getClientIp, logAudit } from "@/lib/audit";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { pumpTestReportPoints, pumpTestReports, requisitionAttachments, testRequisitions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const PATCH_FIELD_MAP: Record<string, string> = {
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

// Source team can only correct the intake details they themselves filled in
// on the New Requisition form -- not testing-workflow fields (status, retest
// flags, observation/results, etc.), which stay testing-team-only.
const SOURCE_EDITABLE_FIELDS = new Set([
  "model",
  "category",
  "ec_quotation_no",
  "offer_date",
  "responsible_person",
  "source_team",
  "date_of_requisition",
  "test_qty",
  "qth",
  "specific_gravity",
  "power_hp",
  "power_kw",
  "head_kgcm2",
  "head_unit",
  "rpm",
  "motor_rpm",
  "req_capacity",
  "req_capacity_unit",
  "media_type",
  "target_date",
  "general_remarks",
]);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { id } = await params;

  const [requisition] = await db.select().from(testRequisitions).where(eq(testRequisitions.id, id)).limit(1);
  if (!requisition) {
    return error("Requisition not found", 404);
  }
  if (claims.role === "source" && requisition.createdBy !== claims.sub) {
    return error("You can only view requisitions you raised.", 403);
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

  // Metadata only (no fileData) -- keeps this response light regardless of
  // how large the attached files are.
  const attachments = await db
    .select({
      id: requisitionAttachments.id,
      requisitionId: requisitionAttachments.requisitionId,
      fileName: requisitionAttachments.fileName,
      mimeType: requisitionAttachments.mimeType,
      fileSize: requisitionAttachments.fileSize,
      uploadedBy: requisitionAttachments.uploadedBy,
      uploadedByName: requisitionAttachments.uploadedByName,
      createdAt: requisitionAttachments.createdAt,
    })
    .from(requisitionAttachments)
    .where(eq(requisitionAttachments.requisitionId, id))
    .orderBy(desc(requisitionAttachments.createdAt));

  return json({
    ...requisitionToDict(requisition),
    reports: reports.map((r) => ({
      ...reportToDict(r),
      points: (pointsByReport.get(r.id) ?? []).map(pointToDict),
    })),
    attachments: attachments.map(attachmentToDict),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }
  const { id } = await params;

  if (claims.role === "source") {
    const [existing] = await db.select().from(testRequisitions).where(eq(testRequisitions.id, id)).limit(1);
    if (!existing) {
      return error("Requisition not found", 404);
    }
    if (existing.createdBy !== claims.sub) {
      return error("You can only edit requisitions you raised.", 403);
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const values: Record<string, unknown> = {};
  for (const [snakeKey, camelKey] of Object.entries(PATCH_FIELD_MAP)) {
    if (body[snakeKey] !== undefined) {
      if (claims.role === "source" && !SOURCE_EDITABLE_FIELDS.has(snakeKey)) {
        continue;
      }
      // The edit form sends "" for any field the user left/made blank.
      // Postgres rejects "" outright for date/numeric columns, so a blank
      // has to become NULL -- and NULL is what "cleared" should mean here
      // anyway (the POST route sidesteps this by skipping "" entirely,
      // which would silently ignore a user clearing a field on edit).
      values[camelKey] = body[snakeKey] === "" ? null : body[snakeKey];
    }
  }
  values.updatedAt = new Date();
  if (claims.role !== "source" && body.status === "Closed") {
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

  const changedFields = Object.keys(values).filter((k) => k !== "updatedAt" && k !== "closedAt");
  await logAudit({
    ipAddress: getClientIp(req),
    userId: claims.sub,
    userEmail: claims.email,
    eventType: "update",
    entityType: "requisition",
    entityId: requisition.id,
    entityLabel: requisition.model,
    details: changedFields.length ? `Changed: ${changedFields.join(", ")}` : null,
  });

  return json(requisitionToDict(requisition));
}
