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
 *
 * Optional `?from=YYYY-MM-DD&to=YYYY-MM-DD` narrows every count to that
 * window: requisitions by `date_of_requisition` (falling back to
 * `created_at` for the rare row missing it), reports/points by the report's
 * `test_date` (same fallback). Distinct models draws from both tables, so
 * it stays in sync with the Pump Dashboard's own "Pump Models" tile. Omit
 * both for the all-time snapshot.
 */
export async function GET(req: Request) {
  try {
    decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  const reqDateCol = sql`coalesce(${testRequisitions.dateOfRequisition}, ${testRequisitions.createdAt}::date)`;
  const reportDateCol = sql`coalesce(${pumpTestReports.testDate}, ${pumpTestReports.createdAt}::date)`;
  const dateRange = (col: ReturnType<typeof sql>) => {
    const parts: ReturnType<typeof sql>[] = [];
    if (from) parts.push(sql`${col} >= ${from}`);
    if (to) parts.push(sql`${col} <= ${to}`);
    return parts.length ? sql.join(parts, sql` and `) : sql`true`;
  };
  const reqDateCondition = dateRange(reqDateCol);
  const reportDateCondition = dateRange(reportDateCol);

  const [requisitionsByStatus, reportsByFormat, totals] = await Promise.all([
    db
      .select({ status: testRequisitions.status, n: sql<number>`count(*)` })
      .from(testRequisitions)
      .where(reqDateCondition)
      .groupBy(testRequisitions.status),
    db
      .select({ format: pumpTestReports.reportFormat, n: sql<number>`count(*)` })
      .from(pumpTestReports)
      .where(reportDateCondition)
      .groupBy(pumpTestReports.reportFormat),
    db
      .select({
        totalRequisitions: sql<number>`(select count(*) from ${testRequisitions} where ${reqDateCondition})`,
        totalReports: sql<number>`(select count(*) from ${pumpTestReports} where ${reportDateCondition})`,
        totalPoints: sql<number>`(select count(*) from ${pumpTestReportPoints} where report_id in (select id from ${pumpTestReports} where ${reportDateCondition}))`,
        // Every distinct pump model known to the portal -- raised for testing
        // OR actually tested, same "normalize away case/punctuation" key the
        // Pump Dashboard groups by (lib/modelKey.ts's normalizeModelKey), so
        // this always agrees with that page's "Pump Models" tile.
        distinctModels: sql<number>`(
          select count(distinct key) from (
            select upper(regexp_replace(model, '[^A-Za-z0-9]', '', 'g')) as key
            from ${testRequisitions} where ${reqDateCondition}
            union
            select upper(regexp_replace(model, '[^A-Za-z0-9]', '', 'g')) as key
            from ${pumpTestReports} where ${reportDateCondition}
          ) all_models
        )`,
      })
      .from(pumpTestReports)
      .limit(1),
  ]);

  // Pass/fail: only meaningful for Closed requisitions that actually have a
  // linked report -- same rule and same computeRequirementStatus formula the
  // Testing Summary page's Green/Red filter uses, so the two never disagree.
  // Scoped by the requisition's own date, same as the "Requisitions Raised"
  // bucket above, so every tile on a filtered view describes the same window.
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
    .where(sql`${testRequisitions.status} = 'Closed' and ${reqDateCondition}`);

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
