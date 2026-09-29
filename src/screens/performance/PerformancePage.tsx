"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPerformance } from "@/services/testingService";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonPage } from "@/components/ui/Skeleton";
import KpiGroupCard from "@/components/charts/KpiGroupCard";
import ChartCard from "@/components/charts/ChartCard";
import { formatDate, formatNumber } from "@/lib/formUtils";
import { reportCategoryLabel } from "@/lib/reportCategory";
import { ME_SUSPECT_ABOVE, VE_SUSPECT_ABOVE } from "@/lib/veMeAcceptance";
import type { PerformanceHistoryEntry, PerformanceImprovement, PerformanceModel, PerformanceResult } from "@/types/testing";

const SERIES = ["All", "H", "2H", "L", "L6", "Other"] as const;
type Series = (typeof SERIES)[number];
const SERIES_LABEL: Record<Series, string> = { All: "All", H: "H-series", "2H": "2H-series", L: "L-series", L6: "L6-series", Other: "Other" };

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const tabular = { fontVariantNumeric: "tabular-nums" } as const;

/** Red when below this model's acceptance figure -- only the value itself, never the row. */
const valueClass = (meets: boolean | null) =>
  meets === false ? "rounded-md bg-neg-soft px-1.5 py-0.5 font-semibold text-neg-strong" : "text-text";

const Delta = ({ value }: { value: number | null }) => {
  if (value === null) return <span className="text-text-faint">—</span>;
  if (value === 0) return <span className="text-text-muted">± 0</span>;
  return value > 0 ? (
    <span className="font-semibold text-pos-strong">▲ +{value}</span>
  ) : (
    <span className="font-semibold text-neg-strong">▼ {value}</span>
  );
};

const delta = (now: number | null, before: number | null) => (now === null || before === null ? null : Math.round((now - before) * 10) / 10);

/** How an Improvement Project test compares with the model's previous test. */
const verdictOf = (i: { ve: number | null; me: number | null; prev_ve: number | null; prev_me: number | null }) => {
  const changes = [delta(i.ve, i.prev_ve), delta(i.me, i.prev_me)].filter((d): d is number => d !== null);
  if (!changes.length) return { label: "No earlier test to compare", tone: "muted" as const };
  if (changes.every((d) => d >= 0) && changes.some((d) => d > 0)) return { label: "Improved", tone: "good" as const };
  if (changes.every((d) => d <= 0) && changes.some((d) => d < 0)) return { label: "Declined", tone: "bad" as const };
  if (changes.every((d) => d === 0)) return { label: "No change", tone: "muted" as const };
  return { label: "Mixed", tone: "warn" as const };
};

const VERDICT_CLASS = {
  good: "bg-pos-soft text-pos-strong",
  bad: "bg-neg-soft text-neg-strong",
  warn: "bg-warn-soft text-warn",
  muted: "bg-bg-sunk text-text-muted",
};

/** VE (blue) and ME (orange) across the model's tests, with the acceptance lines dashed. */
const Trend = ({ history, acceptance }: { history: PerformanceHistoryEntry[]; acceptance: PerformanceModel["acceptance"] }) => {
  const points = history.filter((h) => h.ve !== null || h.me !== null);
  if (points.length < 2) return <span className="text-[11px] text-text-faint">{points.length ? "1 test" : "—"}</span>;
  const w = 96;
  const h = 28;
  const all = points.flatMap((p) => [p.ve, p.me]).filter((v): v is number => v !== null);
  const top = Math.max(100, ...all, acceptance?.ve ?? 0);
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - 2 - (v / top) * (h - 4);
  const line = (field: "ve" | "me") =>
    points
      .map((p, i) => (p[field] === null ? null : `${x(i).toFixed(1)},${y(p[field]!).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" role="img" aria-label={`VE and ME across ${points.length} tests`}>
      {acceptance && <line x1={0} x2={w} y1={y(acceptance.ve)} y2={y(acceptance.ve)} stroke="var(--series-1)" strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />}
      {acceptance && <line x1={0} x2={w} y1={y(acceptance.me)} y2={y(acceptance.me)} stroke="var(--series-2)" strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />}
      <polyline points={line("ve")} fill="none" stroke="var(--series-1)" strokeWidth={1.75} strokeLinejoin="round" />
      <polyline points={line("me")} fill="none" stroke="var(--series-2)" strokeWidth={1.75} strokeLinejoin="round" />
    </svg>
  );
};

/** "12.3 / 12.0" -- best measured point over the rated value, red when it didn't meet it. "—" when
 * there's no rated value on this report to judge against. */
const MeasuredVsRated = ({ measured, rated, meets }: { measured: number | null; rated: number | null; meets: boolean | null }) => {
  if (rated === null) return <span className="text-text-faint">—</span>;
  return (
    <span title={`Rated ${formatNumber(rated)}`}>
      <span className={valueClass(meets)}>{measured === null ? "—" : formatNumber(measured)}</span>
      <span className="text-text-faint"> / {formatNumber(rated)}</span>
    </span>
  );
};

const SuspectNote = ({ entry }: { entry: PerformanceHistoryEntry }) => {
  const parts = [...entry.suspect_ve.map((v) => `VE ${v}%`), ...entry.suspect_me.map((v) => `ME ${v}%`)];
  if (!parts.length) return null;
  return (
    <span
      className="ml-2 rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn"
      title="Physically impossible -- almost always a unit or typing slip in the readings (e.g. LPH typed as m3/hr). Not counted anywhere on this page until the report is corrected."
    >
      ⚠ Check readings: {parts.slice(0, 3).join(", ")}
      {parts.length > 3 ? ` +${parts.length - 3} more` : ""}
    </span>
  );
};

const PerformancePage = () => {
  const [data, setData] = useState<PerformanceResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getPerformance()
      .then(setData)
      .catch(() => setError("Could not load VE & ME performance."));
  }, []);

  if (error) return <div className="form-error-banner">{error}</div>;
  if (!data) return <SkeletonPage cards={3} />;
  return <PerformanceView data={data} />;
};

/** The page body, given the loaded data. */
export const PerformanceView = ({ data }: { data: PerformanceResult }) => {
  const [series, setSeries] = useState<Series>("All");
  const [search, setSearch] = useState("");
  const [belowOnly, setBelowOnly] = useState(false);
  const [suspectOnly, setSuspectOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const belowAtLatest = (m: PerformanceModel) => !!m.acceptance && !!m.latest && (m.latest.ve_meets === false || m.latest.me_meets === false);
  const meetsAtLatest = (m: PerformanceModel) => !!m.acceptance && !!m.latest && m.latest.ve_meets === true && m.latest.me_meets === true;

  const visible = useMemo(() => {
    const q = search.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return data.models.filter(
      (m) =>
        (series === "All" || m.series === series) &&
        (!q || m.model.toUpperCase().replace(/[^A-Z0-9]/g, "").includes(q)) &&
        (!belowOnly || belowAtLatest(m)) &&
        (!suspectOnly || m.suspect_count > 0)
    );
  }, [data, series, search, belowOnly, suspectOnly]);

  const onSheet = data.models.filter((m) => m.acceptance);
  const noData = data.models.filter((m) => m.reports_with_data === 0);
  const suspectReadings = data.models.reduce((n, m) => n + m.suspect_count, 0);

  const toggle = (model: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });

  return (
    <div className="tw-reset mx-auto flex max-w-[1400px] flex-col gap-4 p-2">
      <PageHeader
        icon="📈"
        title="VE & ME Performance"
        subtitle="Every model's best Volumetric and Mechanical Efficiency, judged against its acceptance criteria, test by test."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiGroupCard
          title="Acceptance · latest test"
          icon="check"
          tint="var(--series-3)"
          tiles={[
            { label: "Meeting VE & ME", value: onSheet.filter(meetsAtLatest).length, sub: `of ${onSheet.length} models on the sheet` },
            {
              label: "Below acceptance",
              value: onSheet.filter(belowAtLatest).length,
              sub: "VE or ME short",
              tone: onSheet.some(belowAtLatest) ? "critical" : undefined,
            },
          ]}
        />
        <KpiGroupCard
          title="Coverage"
          icon="folder"
          tint="var(--series-1)"
          tiles={[
            { label: "Models with data", value: data.models.length - noData.length, sub: `of ${data.models.length} models` },
            { label: "No VE/ME yet", value: noData.length, sub: noData.length ? noData.map((m) => m.model).join(", ") : "every model covered" },
          ]}
        />
        <KpiGroupCard
          title="Tracking"
          icon="activity"
          tint="var(--series-2)"
          tiles={[
            { label: "Improvement tests", value: data.improvements.length, sub: "Improvement Project" },
            {
              label: "Readings to check",
              value: suspectReadings,
              sub: `VE > ${VE_SUSPECT_ABOVE}% or ME > ${ME_SUSPECT_ABOVE}%`,
              tone: suspectReadings ? "critical" : undefined,
            },
          ]}
        />
      </div>

      <ImprovementTracker improvements={data.improvements} />

      <ChartCard
        title="By model"
        subtitle="Each report counts its best point · red = below that model's acceptance · open a row for every test in date order"
        legend={[
          { label: "VE", color: "var(--series-1)", shape: "line" },
          { label: "ME", color: "var(--series-2)", shape: "line" },
        ]}
        table={{
          columns: ["Model", "Series", "VE acceptance", "ME acceptance", "Reports", "Latest VE", "Latest ME", "Best VE", "Best ME", "VE change", "ME change"],
          rows: visible.map((m) => [
            m.model,
            SERIES_LABEL[m.series],
            m.acceptance ? `${m.acceptance.ve}%` : "—",
            m.acceptance ? `${m.acceptance.me}%` : "—",
            m.report_count,
            pct(m.latest?.ve ?? null),
            pct(m.latest?.me ?? null),
            pct(m.best_ve),
            pct(m.best_me),
            m.ve_change ?? "—",
            m.me_change ?? "—",
          ]),
        }}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="range-group" role="group" aria-label="Series">
            {SERIES.map((s) => (
              <button key={s} type="button" className="range-pill" aria-pressed={series === s} onClick={() => setSeries(s)}>
                {SERIES_LABEL[s]}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text">
            <input type="checkbox" checked={belowOnly} onChange={(e) => setBelowOnly(e.target.checked)} />
            Below acceptance
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text">
            <input type="checkbox" checked={suspectOnly} onChange={(e) => setSuspectOnly(e.target.checked)} />
            Readings to check
          </label>
          <input
            id="performance-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search model…"
            className="ml-auto w-44 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-text-muted">
                <th className="w-6 pb-2" />
                <th className="pb-2 font-semibold">Model</th>
                <th className="pb-2 text-right font-semibold">Acceptance VE / ME</th>
                <th className="pb-2 text-right font-semibold">Reports</th>
                <th className="pb-2 text-right font-semibold">Latest VE</th>
                <th className="pb-2 text-right font-semibold">Latest ME</th>
                <th className="pb-2 text-right font-semibold">Best VE / ME</th>
                <th className="pb-2 text-right font-semibold">Change, first → latest</th>
                <th className="pb-2 pl-4 font-semibold">Trend</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-sm text-text-muted">
                    No models match these filters.
                  </td>
                </tr>
              )}
              {visible.map((m) => {
                const open = expanded.has(m.model);
                return (
                  <Fragment key={m.model}>
                    <tr className="cursor-pointer border-t border-border transition-colors hover:bg-surface-hover" onClick={() => toggle(m.model)}>
                      <td className="py-2.5 text-text-muted">{m.history.length ? (open ? "−" : "+") : ""}</td>
                      <td className="py-2.5 pr-3">
                        {m.report_count ? (
                          <Link href={`/pumps/${encodeURIComponent(m.model)}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-accent hover:underline">
                            {m.model}
                          </Link>
                        ) : (
                          <span className="font-semibold text-text">{m.model}</span>
                        )}
                        <span className="ml-2 text-[11px] text-text-faint">{SERIES_LABEL[m.series]}</span>
                        {m.improvement_count > 0 && (
                          <span className="ml-2 rounded-md bg-info-soft px-1.5 py-0.5 text-[11px] font-semibold text-info">
                            {m.improvement_count} improvement test{m.improvement_count === 1 ? "" : "s"}
                          </span>
                        )}
                        {m.suspect_count > 0 && (
                          <span className="ml-2 rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn" title="Readings that can't be real -- open the row to see which reports">
                            ⚠ {m.suspect_count} to check
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-text-muted" style={tabular}>
                        {m.acceptance ? `${m.acceptance.ve}% / ${m.acceptance.me}%` : <span title="Not on the acceptance sheet">—</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-text" style={tabular}>
                        {m.report_count === 0 ? (
                          <span className="text-text-faint">Not tested yet</span>
                        ) : m.reports_with_data < m.report_count ? (
                          <span title={`${m.report_count - m.reports_with_data} without VE/ME`}>
                            {m.reports_with_data} of {m.report_count}
                          </span>
                        ) : (
                          m.report_count
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right" style={tabular}>
                        <span className={valueClass(m.latest?.ve_meets ?? null)}>{pct(m.latest?.ve ?? null)}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right" style={tabular}>
                        <span className={valueClass(m.latest?.me_meets ?? null)}>{pct(m.latest?.me ?? null)}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-text-muted" style={tabular}>
                        {pct(m.best_ve)} / {pct(m.best_me)}
                      </td>
                      <td className="py-2.5 pr-3 text-right" style={tabular}>
                        VE <Delta value={m.ve_change} /> · ME <Delta value={m.me_change} />
                      </td>
                      <td className="py-2.5 pl-4">
                        <Trend history={m.history} acceptance={m.acceptance} />
                      </td>
                    </tr>
                    {open && m.history.length > 0 && (
                      <tr>
                        <td />
                        <td colSpan={8} className="pb-3">
                          <table className="w-full border-collapse rounded-lg bg-bg-sunk text-[13px]">
                            <thead>
                              <tr className="text-left text-[10px] uppercase tracking-wide text-text-muted">
                                <th className="px-3 py-2 font-semibold">Test date</th>
                                <th className="px-3 py-2 font-semibold">Report</th>
                                <th className="px-3 py-2 font-semibold">Category</th>
                                <th className="px-3 py-2 text-right font-semibold">Capacity, m³/hr</th>
                                <th className="px-3 py-2 text-right font-semibold">Head, kg/cm²</th>
                                <th className="px-3 py-2 text-right font-semibold">Power, kW</th>
                                <th className="px-3 py-2 text-right font-semibold">VE</th>
                                <th className="px-3 py-2 text-right font-semibold">vs previous</th>
                                <th className="px-3 py-2 text-right font-semibold">ME</th>
                                <th className="px-3 py-2 text-right font-semibold">vs previous</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...m.history].reverse().map((h) => (
                                <tr key={h.id} className={`border-t border-border-soft ${h.is_improvement ? "bg-info-soft" : ""}`}>
                                  <td className="px-3 py-1.5 text-text-muted" style={tabular}>
                                    {formatDate(h.date)}
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <Link href={`/reports/${h.report_no ?? h.id}`} className="font-semibold text-accent hover:underline">
                                      {h.report_no ?? "View"}
                                    </Link>
                                    <SuspectNote entry={h} />
                                  </td>
                                  <td className="px-3 py-1.5 text-text-muted">
                                    {h.is_improvement ? (
                                      <span className="rounded-md bg-info px-1.5 py-0.5 text-[11px] font-semibold text-white">Improvement Project</span>
                                    ) : h.category !== "none" ? (
                                      reportCategoryLabel(h.category).replace(/^Against\s+/i, "")
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-right" style={tabular}>
                                    <MeasuredVsRated measured={h.max_capacity} rated={h.rated_capacity} meets={h.capacity_meets} />
                                  </td>
                                  <td className="px-3 py-1.5 text-right" style={tabular}>
                                    <MeasuredVsRated measured={h.max_head} rated={h.rated_head} meets={h.head_meets} />
                                  </td>
                                  <td className="px-3 py-1.5 text-right" style={tabular}>
                                    <MeasuredVsRated measured={h.max_power} rated={h.rated_power_kw} meets={h.power_meets} />
                                  </td>
                                  <td className="px-3 py-1.5 text-right" style={tabular}>
                                    <span className={valueClass(h.ve_meets)}>{pct(h.ve)}</span>
                                  </td>
                                  <td className="px-3 py-1.5 text-right" style={tabular}>
                                    <Delta value={delta(h.ve, h.prev_ve)} />
                                  </td>
                                  <td className="px-3 py-1.5 text-right" style={tabular}>
                                    <span className={valueClass(h.me_meets)}>{pct(h.me)}</span>
                                  </td>
                                  <td className="px-3 py-1.5 text-right" style={tabular}>
                                    <Delta value={delta(h.me, h.prev_me)} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
};

/** Every Improvement Project test next to the model's previous test: before, after, and the verdict. */
const ImprovementTracker = ({ improvements }: { improvements: PerformanceImprovement[] }) => (
  <ChartCard
    title="Improvement Projects"
    subtitle="Each Improvement Project test compared with the same model's previous test"
    table={{
      columns: ["Model", "Report", "Date", "VE before", "VE after", "ME before", "ME after", "Verdict"],
      rows: improvements.map((i) => [i.model, i.report_no ?? "", i.date, pct(i.prev_ve), pct(i.ve), pct(i.prev_me), pct(i.me), verdictOf(i).label]),
    }}
  >
    {improvements.length === 0 ? (
      <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-text-muted">
        <p className="m-0 font-semibold text-text">No Improvement Project tests yet.</p>
        <p className="m-0 mt-1">
          To track one, raise a requisition with the category <strong>Against Improvement Project</strong>. When its report is filed, it shows up here
          next to that model&apos;s previous test, with VE and ME before and after, and whether it now meets the acceptance criteria.
        </p>
        <Link href="/requisitions/new" className="mt-3 inline-block font-semibold text-accent hover:underline">
          Raise an Improvement Project requisition →
        </Link>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-text-muted">
              <th className="pb-2 font-semibold">Model</th>
              <th className="pb-2 font-semibold">Report</th>
              <th className="pb-2 font-semibold">Date</th>
              <th className="pb-2 text-right font-semibold">VE before → after</th>
              <th className="pb-2 text-right font-semibold">ME before → after</th>
              <th className="pb-2 pl-4 font-semibold">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {[...improvements].sort((a, b) => b.date.localeCompare(a.date)).map((i) => {
              const verdict = verdictOf(i);
              return (
                <tr key={i.id} className="border-t border-border">
                  <td className="py-2.5 pr-3 font-semibold text-text">{i.model}</td>
                  <td className="py-2.5 pr-3">
                    <Link href={`/reports/${i.report_no ?? i.id}`} className="font-semibold text-accent hover:underline">
                      {i.report_no ?? "View"}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-text-muted" style={tabular}>
                    {formatDate(i.date)}
                  </td>
                  <td className="py-2.5 pr-3 text-right" style={tabular}>
                    {pct(i.prev_ve)} → <span className={valueClass(i.ve_meets)}>{pct(i.ve)}</span> <Delta value={delta(i.ve, i.prev_ve)} />
                  </td>
                  <td className="py-2.5 pr-3 text-right" style={tabular}>
                    {pct(i.prev_me)} → <span className={valueClass(i.me_meets)}>{pct(i.me)}</span> <Delta value={delta(i.me, i.prev_me)} />
                  </td>
                  <td className="py-2.5 pl-4">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${VERDICT_CLASS[verdict.tone]}`}>{verdict.label}</span>
                    {i.acceptance && (
                      <span className="ml-2 text-xs text-text-muted">
                        {i.ve_meets && i.me_meets ? "now meets acceptance" : "still below acceptance"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </ChartCard>
);

export default PerformancePage;
