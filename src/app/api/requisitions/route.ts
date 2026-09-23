import { and, desc, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";

import { error, json, requisitionToDict } from "@/lib/api";
import { getClientIp, logAudit } from "@/lib/audit";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { pumpTestReportPoints, pumpTestReports, testRequisitions, users } from "@/lib/db/schema";
import { offsetFor, PAGE_SIZE, parsePage } from "@/lib/pagination";
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

type RequisitionRow = typeof testRequisitions.$inferSelect;

/** Attaches report_id/report_no/report_requirement_unmet_fields to a set of
 * requisition rows -- whether the linked report (if any) reached its rated
 * head/capacity/power, aggregated in SQL from its points rather than
 * shipped down to compute in the list view. Shared by every path below. */
async function reportStatusFor(rows: RequisitionRow[]) {
  const requisitionIds = rows.map((r) => r.id);
  const reports = requisitionIds.length
    ? await db
        .select({
          id: pumpTestReports.id,
          reportNo: pumpTestReports.reportNo,
          requisitionId: pumpTestReports.requisitionId,
          ratedHead: pumpTestReports.ratedHead,
          ratedCapacity: pumpTestReports.ratedCapacity,
          ratedPowerKw: pumpTestReports.ratedPowerKw,
        })
        .from(pumpTestReports)
        .where(inArray(pumpTestReports.requisitionId, requisitionIds))
    : [];
  const reportIdByRequisition = new Map(reports.map((r) => [r.requisitionId, r.id]));
  const reportNoByRequisition = new Map(reports.map((r) => [r.requisitionId, r.reportNo]));

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

  return { reportIdByRequisition, reportNoByRequisition, unmetByRequisition };
}

function dictify(
  rows: RequisitionRow[],
  status: Awaited<ReturnType<typeof reportStatusFor>>
) {
  return rows.map((r) => ({
    ...requisitionToDict(r),
    report_id: status.reportIdByRequisition.get(r.id) ?? null,
    report_no: status.reportNoByRequisition.get(r.id) ?? null,
    report_requirement_unmet_fields: status.unmetByRequisition.get(r.id) ?? [],
  }));
}

/** Server-paginated, 25/page, with the Testing Summary filter bar's full
 * filter set applied as SQL WHERE clauses. The one exception is
 * `report_result` (Green/Met vs Red/Not-Met) -- it depends on a computed
 * aggregate (see reportStatusFor above), not a plain column, so it can't be
 * pushed into SQL. It's only ever used already narrowed to one Category
 * (see the frontend), so that path fetches every row matching the other
 * filters, computes status, filters and paginates in memory instead. */
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
  const model = searchParams.get("model");
  const ecQuotationNo = searchParams.get("ec_quotation_no");
  const category = searchParams.get("category");
  const sourceTeam = searchParams.get("source_team");
  const responsiblePerson = searchParams.get("responsible_person");
  const submittedBy = searchParams.get("submitted_by");
  const retestNeeded = searchParams.get("retest_needed");
  const month = searchParams.get("month");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const reportResult = searchParams.get("report_result");
  const page = parsePage(req);

  const conditions = [];
  if (status) conditions.push(eq(testRequisitions.status, status));
  // Source teams only see the requisitions they personally raised — testing
  // team and admins still see everything, since they process all of them.
  if (claims.role === "source") conditions.push(eq(testRequisitions.createdBy, claims.sub));
  if (model) conditions.push(eq(testRequisitions.model, model));
  if (ecQuotationNo) conditions.push(ilike(testRequisitions.ecQuotationNo, `%${ecQuotationNo}%`));
  if (category) conditions.push(eq(testRequisitions.category, category));
  if (sourceTeam) conditions.push(eq(testRequisitions.sourceTeam, sourceTeam));
  if (responsiblePerson) conditions.push(eq(testRequisitions.responsiblePerson, responsiblePerson));
  if (submittedBy) conditions.push(eq(testRequisitions.submittedBy, submittedBy));
  if (retestNeeded === "true") conditions.push(eq(testRequisitions.retestNeeded, true));
  if (retestNeeded === "false") conditions.push(eq(testRequisitions.retestNeeded, false));
  if (month) conditions.push(sql`substring(${testRequisitions.dateOfRequisition}::text, 1, 7) = ${month}`);
  if (dateFrom) conditions.push(gte(testRequisitions.dateOfRequisition, dateFrom));
  if (dateTo) conditions.push(lte(testRequisitions.dateOfRequisition, dateTo));
  const where = conditions.length ? and(...conditions) : undefined;

  // Every-other-filter-but-report_result scope -- backs the Green/Not Met
  // pill counts shown once a Category is picked, regardless of which pill
  // (if any) is currently selected.
  let reportResultCounts: { green: number; red: number } | null = null;
  if (category) {
    const scopedRows = await db.select().from(testRequisitions).where(where).orderBy(desc(testRequisitions.createdAt));
    const scopedStatus = await reportStatusFor(scopedRows);
    let green = 0;
    let red = 0;
    for (const r of scopedRows) {
      if (r.status !== "Closed" || !scopedStatus.reportIdByRequisition.get(r.id)) continue;
      const unmet = (scopedStatus.unmetByRequisition.get(r.id) ?? []).length > 0;
      if (unmet) red += 1;
      else green += 1;
    }
    reportResultCounts = { green, red };

    if (reportResult === "green" || reportResult === "red") {
      const filtered = scopedRows.filter((r) => {
        if (r.status !== "Closed" || !scopedStatus.reportIdByRequisition.get(r.id)) return false;
        const unmet = (scopedStatus.unmetByRequisition.get(r.id) ?? []).length > 0;
        return reportResult === "red" ? unmet : !unmet;
      });
      const pageRows = filtered.slice(offsetFor(page), offsetFor(page) + PAGE_SIZE);
      return json({
        entries: dictify(pageRows, scopedStatus),
        total: filtered.length,
        page,
        page_size: PAGE_SIZE,
        report_result_counts: reportResultCounts,
      });
    }
  }

  const [rows, [{ count }]] = await Promise.all([
    db
      .select()
      .from(testRequisitions)
      .where(where)
      .orderBy(desc(testRequisitions.createdAt))
      .limit(PAGE_SIZE)
      .offset(offsetFor(page)),
    db.select({ count: sql<number>`count(*)::int` }).from(testRequisitions).where(where),
  ]);
  const rowStatus = await reportStatusFor(rows);

  return json({
    entries: dictify(rows, rowStatus),
    total: count,
    page,
    page_size: PAGE_SIZE,
    report_result_counts: reportResultCounts,
  });
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

  const seqResult = await db.execute<{ n: number }>(
    sql`select nextval('test_requisitions_requisition_no_seq') as n`
  );
  const requisitionNo = `REQ-${String(seqResult.rows[0].n).padStart(6, "0")}`;

  const [requisition] = await db
    .insert(testRequisitions)
    .values({
      ...values,
      requisitionNo,
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
