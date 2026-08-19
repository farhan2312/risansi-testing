import { inArray, sql } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { pumpTestReportPoints, pumpTestReports, testRequisitions } from "@/lib/db/schema";
import { computeRequirementStatus } from "@/lib/requirementCheck";

export const dynamic = "force-dynamic";

/**
 * Portal-wide snapshot for the landing overview page -- counts only, no row
 * data, so this stays cheap regardless of how many reports/points pile up.
 */
export async function GET(req: Request) {
  try {
    decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const [requisitionsByStatus, reportsByFormat, totals] = await Promise.all([
    db
      .select({ status: testRequisitions.status, n: sql<number>`count(*)` })
      .from(testRequisitions)
      .groupBy(testRequisitions.status),
    db
      .select({ format: pumpTestReports.reportFormat, n: sql<number>`count(*)` })
      .from(pumpTestReports)
      .groupBy(pumpTestReports.reportFormat),
    db
      .select({
        totalRequisitions: sql<number>`(select count(*) from ${testRequisitions})`,
        totalReports: sql<number>`(select count(*) from ${pumpTestReports})`,
        totalPoints: sql<number>`(select count(*) from ${pumpTestReportPoints})`,
        distinctModels: sql<number>`(select count(distinct ${pumpTestReports.model}) from ${pumpTestReports})`,
      })
      .from(pumpTestReports)
      .limit(1),
  ]);

  // Pass/fail: only meaningful for Closed requisitions that actually have a
  // linked report -- same rule and same computeRequirementStatus formula the
  // Testing Summary page's Green/Red filter uses, so the two never disagree.
  const closedWithReport = await db
    .select({
      requisitionId: testRequisitions.id,
      ratedHead: pumpTestReports.ratedHead,
      ratedCapacity: pumpTestReports.ratedCapacity,
      ratedPowerKw: pumpTestReports.ratedPowerKw,
      reportId: pumpTestReports.id,
    })
    .from(testRequisitions)
    .innerJoin(pumpTestReports, sql`${pumpTestReports.requisitionId} = ${testRequisitions.id}`)
    .where(sql`${testRequisitions.status} = 'Closed'`);

  const reportIds = closedWithReport.map((r) => r.reportId);
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

  let requirementMet = 0;
  let requirementUnmet = 0;
  for (const r of closedWithReport) {
    const max = maxByReport.get(r.reportId);
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
    const unmet = [status.head, status.capacity, status.power].some((v) => v === false);
    const hasAnyTarget = [status.head, status.capacity, status.power].some((v) => v !== null);
    if (!hasAnyTarget) continue; // nothing to judge -- not counted either way
    if (unmet) requirementUnmet++;
    else requirementMet++;
  }

  return json({
    total_requisitions: totals[0]?.totalRequisitions ?? 0,
    requisitions_by_status: Object.fromEntries(requisitionsByStatus.map((r) => [r.status, Number(r.n)])),
    total_reports: totals[0]?.totalReports ?? 0,
    reports_by_format: Object.fromEntries(reportsByFormat.map((r) => [r.format ?? "observation", Number(r.n)])),
    total_test_points: totals[0]?.totalPoints ?? 0,
    distinct_models_tested: totals[0]?.distinctModels ?? 0,
    requirement_met: requirementMet,
    requirement_unmet: requirementUnmet,
  });
}
