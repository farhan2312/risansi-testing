import { desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { error, json, pointToDict, reportToDict } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { pumpTestReportPoints, pumpTestReports, testRequisitions, users } from "@/lib/db/schema";
import { POINT_FIELD_MAP, REPORT_FIELD_MAP } from "@/lib/reportFieldMaps";

export const dynamic = "force-dynamic";

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

  const seqResult = await db.execute<{ n: number }>(
    sql`select nextval('pump_test_reports_report_no_seq') as n`
  );
  const reportNo = `TR-${String(seqResult.rows[0].n).padStart(6, "0")}`;

  // "Prepared By" is always the logged-in submitter, computed server-side —
  // never trusted from the request body, and never touched on edit.
  const [submitter] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);
  const preparedBy = submitter?.name ?? claims.email;

  const reportValues: Record<string, unknown> = { model, requisitionId, reportNo, preparedBy };
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
