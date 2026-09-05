import { inArray } from "drizzle-orm";

import { error, json, pointToDict, reportToDict, requisitionToDict } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { pumpTestReportPoints, pumpTestReports, testRequisitions } from "@/lib/db/schema";
import { modelDisplayLabel, normalizeModelKey } from "@/lib/modelKey";

export const dynamic = "force-dynamic";

// Everything for one physical pump, matched across test_requisitions and
// pump_test_reports by normalized model (case/punctuation/spacing
// insensitive) -- same matching Report Archive uses to group pumps, so a
// pump's dashboard always contains exactly what its archive group shows.
export async function GET(req: Request, { params }: { params: Promise<{ model: string }> }) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { model } = await params;
  const target = normalizeModelKey(decodeURIComponent(model));
  if (!target) {
    return error("Model is required", 400);
  }

  const [allRequisitions, allReports] = await Promise.all([
    db.select().from(testRequisitions),
    db.select().from(pumpTestReports),
  ]);

  let requisitions = allRequisitions.filter((r) => normalizeModelKey(r.model) === target);
  // Source teams only see the requisitions they personally raised -- testing
  // team and admins still see everything, matching GET /api/requisitions.
  if (claims.role === "source") {
    requisitions = requisitions.filter((r) => r.createdBy === claims.sub);
  }

  const reports = allReports.filter((r) => normalizeModelKey(r.model) === target);

  if (requisitions.length === 0 && reports.length === 0) {
    return error("Pump not found", 404);
  }

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

  const displayModel = modelDisplayLabel([...reports, ...requisitions]);

  // Every requisition for this model is already in memory (allRequisitions
  // above) -- reuse it rather than a fresh query, same "which requisition is
  // this report linked to" join reports/[id] does, just batched.
  const requisitionNoById = new Map(allRequisitions.map((r) => [r.id, r.requisitionNo]));

  return json({
    model: displayModel,
    requisitions: requisitions
      .sort((a, b) => (b.createdAt?.toString() ?? "").localeCompare(a.createdAt?.toString() ?? ""))
      .map(requisitionToDict),
    reports: reports
      .sort((a, b) => (b.createdAt?.toString() ?? "").localeCompare(a.createdAt?.toString() ?? ""))
      .map((r) => ({
        ...reportToDict(r),
        requisition_no: r.requisitionId ? requisitionNoById.get(r.requisitionId) ?? null : null,
        points: (pointsByReport.get(r.id) ?? []).map(pointToDict),
      })),
  });
}
