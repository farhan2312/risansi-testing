import { desc } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { pumpTestReports } from "@/lib/db/schema";
import { modelDisplayLabel, normalizeModelKey } from "@/lib/modelKey";
import { enrichReports } from "@/lib/reportEnrichment";
import { ME_SUSPECT_ABOVE, VE_ME_ACCEPTANCE_MODELS, VE_SUSPECT_ABOVE, veMeAcceptanceFor } from "@/lib/veMeAcceptance";

export const dynamic = "force-dynamic";

const IMPROVEMENT = "Against Improvement Project";

/** "H-series" / "2H-series" / "L-series" / "L6-series", same grouping as the acceptance sheet. */
const seriesOf = (modelKey: string): string => {
  if (/^2H\d+$/.test(modelKey)) return "2H";
  if (/^H\d+L6$/.test(modelKey)) return "L6";
  if (/^H\d+L$/.test(modelKey)) return "L";
  if (/^H\d+$/.test(modelKey)) return "H";
  return "Other";
};

const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

const maxOf = (values: (number | null)[] | undefined): number | null => {
  const nums = (values ?? []).filter((v): v is number => v !== null);
  return nums.length ? Math.max(...nums) : null;
};

/**
 * VE & ME performance for every model: each report's best VE and best ME point (the same "Max VE /
 * Max ME" the Report Archive shows), its model's acceptance criteria (lib/veMeAcceptance.ts), and
 * every report in date order so a change can be judged against the test before it.
 *
 * Covers every model that has a report AND every model in the acceptance sheet, so a model that has
 * never been tested (or has no VE/ME recorded) still shows up rather than silently missing.
 *
 * Improvement tracking: a report in the "Against Improvement Project" category is compared with the
 * model's previous report that has VE/ME data -- before vs. after, and whether it now meets acceptance.
 */
export async function GET(req: Request) {
  try {
    await decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const rows = await db.select().from(pumpTestReports).orderBy(desc(pumpTestReports.createdAt));
  const reports = await enrichReports(rows);
  const dayOf = (r: (typeof reports)[number]) => r.test_date ?? r.created_at?.toISOString().slice(0, 10) ?? "";

  const byModel = new Map<string, typeof reports>();
  for (const r of reports) {
    const key = normalizeModelKey(r.model);
    byModel.set(key, [...(byModel.get(key) ?? []), r]);
  }
  // Models on the acceptance sheet that have never been tested still get a row.
  for (const model of VE_ME_ACCEPTANCE_MODELS) {
    const key = normalizeModelKey(model);
    if (!byModel.has(key)) byModel.set(key, []);
  }

  const models = [...byModel.entries()].map(([key, modelReports]) => {
    const label = modelReports.length ? modelDisplayLabel(modelReports) : (VE_ME_ACCEPTANCE_MODELS.find((m) => normalizeModelKey(m) === key) ?? key);
    const acceptance = veMeAcceptanceFor(label);

    // Oldest first, so "previous test" and "first -> latest" read naturally.
    const ordered = [...modelReports].sort((a, b) => dayOf(a).localeCompare(dayOf(b)) || (a.report_no ?? "").localeCompare(b.report_no ?? ""));
    let prev: { ve: number | null; me: number | null } | null = null;
    const history = ordered.map((r) => {
      // A report's VE/ME = its best point that's physically possible; impossible points are counted
      // separately so they can be flagged for correction rather than silently winning "best".
      const plausibleVe = (r.points_ve ?? []).filter((v) => v <= VE_SUSPECT_ABOVE);
      const plausibleMe = (r.points_me ?? []).filter((v) => v <= ME_SUSPECT_ABOVE);
      const ve = plausibleVe.length ? round1(Math.max(...plausibleVe)) : null;
      const me = plausibleMe.length ? round1(Math.max(...plausibleMe)) : null;
      const suspect_ve = (r.points_ve ?? []).filter((v) => v > VE_SUSPECT_ABOVE).map((v) => round1(v)!);
      const suspect_me = (r.points_me ?? []).filter((v) => v > ME_SUSPECT_ABOVE).map((v) => round1(v)!);
      const hasData = ve !== null || me !== null;
      // Capacity/Head are floor targets (the best point has to reach the rated value), Power is a
      // ceiling (the best point has to stay under it) -- same rule as computeRequirementStatus, already
      // applied once by enrichReports into requirement_unmet_fields, reused here rather than re-derived.
      const unmet = new Set(r.requirement_unmet_fields ?? []);
      const meets = (label: string, rated: number | null) => (rated === null ? null : !unmet.has(label));
      const ratedCapacity = r.rated_capacity === null ? null : Number(r.rated_capacity);
      const ratedHead = r.rated_head === null ? null : Number(r.rated_head);
      const ratedPowerKw = r.rated_power_kw === null ? null : Number(r.rated_power_kw);
      const entry = {
        id: r.id,
        report_no: r.report_no,
        date: dayOf(r),
        category: r.report_category ?? "none",
        is_improvement: r.report_category === IMPROVEMENT,
        ve,
        me,
        suspect_ve,
        suspect_me,
        ve_meets: acceptance && ve !== null ? ve >= acceptance.ve : null,
        me_meets: acceptance && me !== null ? me >= acceptance.me : null,
        prev_ve: prev?.ve ?? null,
        prev_me: prev?.me ?? null,
        rated_capacity: ratedCapacity,
        rated_head: ratedHead,
        rated_power_kw: ratedPowerKw,
        max_capacity: maxOf(r.points_capacity_m3hr),
        max_head: maxOf(r.points_head_kgcm2),
        max_power: maxOf(r.points_power_kw),
        capacity_meets: meets("Capacity", ratedCapacity),
        head_meets: meets("Head", ratedHead),
        power_meets: meets("Power", ratedPowerKw),
      };
      if (hasData) prev = { ve, me };
      return entry;
    });

    const withData = history.filter((h) => h.ve !== null || h.me !== null);
    const first = withData[0] ?? null;
    const latest = withData.at(-1) ?? null;
    const best = (field: "ve" | "me") => {
      const values = withData.map((h) => h[field]).filter((v): v is number => v !== null);
      return values.length ? Math.max(...values) : null;
    };
    const meetsBoth = (h: (typeof history)[number]) => h.ve_meets === true && h.me_meets === true;

    return {
      model: label,
      series: seriesOf(key),
      acceptance,
      report_count: history.length,
      reports_with_data: withData.length,
      latest,
      best_ve: best("ve"),
      best_me: best("me"),
      ve_change: first && latest && first !== latest && first.ve !== null && latest.ve !== null ? round1(latest.ve - first.ve) : null,
      me_change: first && latest && first !== latest && first.me !== null && latest.me !== null ? round1(latest.me - first.me) : null,
      reports_meeting_both: acceptance ? withData.filter(meetsBoth).length : null,
      improvement_count: history.filter((h) => h.is_improvement).length,
      suspect_count: history.reduce((n, h) => n + h.suspect_ve.length + h.suspect_me.length, 0),
      history,
    };
  });

  const SERIES_ORDER = ["H", "2H", "L", "L6", "Other"];
  const modelNumber = (m: string) => Number(/\d+/.exec(m.replace(/^2H/, ""))?.[0] ?? 0);
  models.sort(
    (a, b) => SERIES_ORDER.indexOf(a.series) - SERIES_ORDER.indexOf(b.series) || modelNumber(a.model) - modelNumber(b.model) || a.model.localeCompare(b.model)
  );

  // Every Improvement Project test, judged against the test before it on the same model.
  const improvements = models.flatMap((m) =>
    m.history
      .filter((h) => h.is_improvement)
      .map((h) => ({
        model: m.model,
        acceptance: m.acceptance,
        id: h.id,
        report_no: h.report_no,
        date: h.date,
        ve: h.ve,
        me: h.me,
        prev_ve: h.prev_ve,
        prev_me: h.prev_me,
        ve_meets: h.ve_meets,
        me_meets: h.me_meets,
      }))
  );

  return json({ models, improvements });
}
