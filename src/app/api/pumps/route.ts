import { desc, eq } from "drizzle-orm";

import { error, json, requisitionToDict } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { pumpTestReports, testRequisitions } from "@/lib/db/schema";
import { modelDisplayLabel, normalizeModelKey } from "@/lib/modelKey";
import { enrichReports } from "@/lib/reportEnrichment";
import { hasActiveRequisitionFilters, requisitionMatchesFilters } from "@/lib/requisitionFilters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type RatedFields = { rated_head: unknown; rated_capacity: unknown; rated_power_kw: unknown };

const hasTarget = (r: RatedFields) => r.rated_head !== null || r.rated_capacity !== null || r.rated_power_kw !== null;

type StatFilter = "all" | "historical" | "met" | "unmet";

function pumpMatchesStatFilter(
  reports: ({ prepared_by: string | null; requirement_unmet_fields: string[] } & RatedFields)[],
  filter: StatFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "historical") return reports.some((r) => r.prepared_by === "Legacy Import");
  if (filter === "met") return reports.some((r) => hasTarget(r) && r.requirement_unmet_fields.length === 0);
  return reports.some((r) => hasTarget(r) && r.requirement_unmet_fields.length > 0);
}

/** Report Compilation, grouped by physical pump and server-paginated
 * 50 pumps/page -- same "group + filter + paginate in memory" approach as
 * GET /api/reports/grouped, for the same reason: which pump a row belongs
 * to, and whether it "matches" the stat tiles (met/unmet/historical), both
 * depend on computed fields (enrichReports, requirement status), not plain
 * columns. Every report and (role-scoped) requisition is fetched once,
 * grouped, filtered, and paginated here; each returned pump group carries
 * its OWN full requisitions/reports (not pre-filtered further), and the
 * client still applies the same per-pump "which of this pump's rows match"
 * display logic it already had (see PumpIndexPage.tsx) -- only "which 50
 * pumps are on this page" moved server-side. */
export async function GET(req: Request) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const statFilter = (searchParams.get("stat_filter") as StatFilter | null) ?? "all";
  const modelFilter = searchParams.get("model");
  const rawPage = Number(searchParams.get("page"));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const filterValues = {
    ecQuotationNo: searchParams.get("ec_quotation_no") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    sourceTeam: searchParams.get("source_team") ?? undefined,
    responsiblePerson: searchParams.get("responsible_person") ?? undefined,
    submittedBy: searchParams.get("submitted_by") ?? undefined,
    retestNeeded: (searchParams.get("retest_needed") as "Yes" | "No" | null) ?? undefined,
    month: searchParams.get("month") ?? undefined,
    dateFrom: searchParams.get("date_from") ?? undefined,
    dateTo: searchParams.get("date_to") ?? undefined,
  };
  const activeReqFilters = hasActiveRequisitionFilters(filterValues);

  const [reportRows, requisitionRows] = await Promise.all([
    db.select().from(pumpTestReports).orderBy(desc(pumpTestReports.createdAt)),
    // Source teams only see the requisitions they personally raised —
    // matching GET /api/requisitions's same rule.
    claims.role === "source"
      ? db.select().from(testRequisitions).where(eq(testRequisitions.createdBy, claims.sub)).orderBy(desc(testRequisitions.createdAt))
      : db.select().from(testRequisitions).orderBy(desc(testRequisitions.createdAt)),
  ]);
  const reports = await enrichReports(reportRows);
  const requisitions = requisitionRows.map(requisitionToDict);

  const groups = new Map<string, { reports: typeof reports; requisitions: typeof requisitions }>();
  for (const r of reports) {
    const key = normalizeModelKey(r.model);
    const g = groups.get(key) ?? { reports: [], requisitions: [] };
    g.reports.push(r);
    groups.set(key, g);
  }
  for (const r of requisitions) {
    const key = normalizeModelKey(r.model);
    const g = groups.get(key) ?? { reports: [], requisitions: [] };
    g.requisitions.push(r);
    groups.set(key, g);
  }

  const createdDateOf = (d: Date | null) => d?.toISOString().slice(0, 10) ?? "";
  const allPumps = [...groups.values()].map((g) => {
    const dates = [
      ...g.reports.map((r) => r.test_date ?? createdDateOf(r.created_at)),
      ...g.requisitions.map((r) => createdDateOf(r.created_at)),
    ].filter(Boolean);
    return {
      model: modelDisplayLabel([...g.reports, ...g.requisitions]),
      report_count: g.reports.length,
      requisition_count: g.requisitions.length,
      latest_date: dates.sort().at(-1) ?? "-",
      reports: g.reports,
      requisitions: g.requisitions,
    };
  });

  // Portal-wide totals for the KPI stat tiles -- deliberately NOT scoped to
  // any of the filters below (matches the pre-pagination behavior: these
  // are always the whole catalog's numbers, just clickable shortcuts into
  // the historical/met/unmet filter).
  let historical = 0;
  let met = 0;
  let unmet = 0;
  for (const r of reports) {
    if (r.prepared_by === "Legacy Import") historical++;
    if (!hasTarget(r)) continue;
    if (r.requirement_unmet_fields.length > 0) unmet++;
    else met++;
  }
  const summary = { total_reports: reports.length, historical, met, unmet, pump_count: allPumps.length };

  const filterOptions = {
    models: allPumps.map((p) => p.model).sort((a, b) => a.localeCompare(b)),
    submitted_by: [...new Set(requisitions.map((r) => r.submitted_by).filter((v): v is string => Boolean(v)))].sort(
      (a, b) => a.localeCompare(b)
    ),
    months: [
      ...new Set(
        requisitions.map((r) => r.date_of_requisition?.slice(0, 7)).filter((v): v is string => Boolean(v))
      ),
    ]
      .sort()
      .reverse(),
  };

  const matching = allPumps
    .filter((p) => pumpMatchesStatFilter(p.reports, statFilter))
    .filter((p) => !modelFilter || p.model === modelFilter)
    // A report-only pump (a legacy import with zero requisitions) never has
    // a Category/Source Team/etc. to check against -- requiring a match
    // would silently drop it on every one of these filters, so a pump with
    // no requisitions has nothing to disqualify it and stays; only a pump
    // that DOES have requisitions, none matching, gets filtered out.
    .filter(
      (p) =>
        !activeReqFilters ||
        p.requisitions.length === 0 ||
        p.requisitions.some((r) => requisitionMatchesFilters(r, filterValues))
    )
    .filter((p) => !search || p.model.toLowerCase().includes(search))
    .sort((a, b) => a.model.localeCompare(b.model));

  const offset = (page - 1) * PAGE_SIZE;
  return json({
    entries: matching.slice(offset, offset + PAGE_SIZE),
    total: matching.length,
    page,
    page_size: PAGE_SIZE,
    summary,
    filter_options: filterOptions,
  });
}
