"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "../dashboard/DashboardPage.css"; // reuses .status-pill / .status-* colors
import { getOverview } from "@/services/testingService";
import { useAuth } from "@/contexts/AuthContext";
import { SkeletonPage } from "@/components/ui/Skeleton";
import HeroHeader from "@/components/ui/HeroHeader";
import { formatDate } from "@/lib/formUtils";
import ChartCard from "@/components/charts/ChartCard";
import KpiCard from "@/components/charts/KpiCard";
import LineChart from "@/components/charts/LineChart";
import DonutChart from "@/components/charts/DonutChart";
import BarList from "@/components/charts/BarList";
import Heatmap, { monthRange } from "@/components/charts/Heatmap";
import { monthLong } from "@/components/charts/chartUtils";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { presetValue, type DateRangeValue, type PresetKey } from "@/lib/dateRangePresets";
import type { PortalOverview, RequisitionStatus } from "@/types/testing";

const OVERVIEW_PRESETS: Exclude<PresetKey, "custom">[] = ["today", "week", "month", "7d", "30d", "90d", "12m", "all"];

// Color follows the entity: each status keeps its slot on every chart. Ring
// order Pending -> In Testing -> Closed -> Retest keeps every adjacent pair
// on the validated adjacent list (orange and yellow never touch).
const STATUS_SEGMENTS: { status: RequisitionStatus; color: string }[] = [
  { status: "Pending", color: "var(--series-1)" },
  { status: "In Testing", color: "var(--series-2)" },
  { status: "Closed", color: "var(--series-3)" },
  { status: "Retest Needed", color: "var(--series-4)" },
];

const FORMAT_LABELS: Record<string, string> = {
  observation: "Observation Sheet",
  "viscosity-chart": "Viscosity Chart",
};

const timeOfDayGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

const TODAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

const pctChange = (now: number, before: number | undefined) =>
  before === undefined ? null : before === 0 ? (now === 0 ? 0 : null) : ((now - before) / before) * 100;

const DeadlineBadge = ({ daysLeft }: { daysLeft: number }) => {
  if (daysLeft < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neg-soft px-2 py-0.5 text-xs font-semibold text-neg-strong">
        ⚠ {Math.abs(daysLeft)}d overdue
      </span>
    );
  }
  if (daysLeft <= 5) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">
        ⏰ {daysLeft === 0 ? "due today" : `in ${daysLeft}d`}
      </span>
    );
  }
  return <span className="text-xs text-text-muted">in {daysLeft}d</span>;
};

const ResultBadge = ({ unmet, hasTarget }: { unmet: string[]; hasTarget: boolean }) => {
  if (!hasTarget) return <span className="text-xs text-text-faint">No target</span>;
  if (unmet.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-pos-soft px-2 py-0.5 text-xs font-semibold text-pos-strong">
        ✓ Met
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-neg-soft px-2 py-0.5 text-xs font-semibold text-neg-strong"
      title={`Outside rated ${unmet.join(", ")}`}
    >
      ✕ Missed {unmet.join(", ")}
    </span>
  );
};

const OverviewPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState<PortalOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [range, setRange] = useState<DateRangeValue>(() => presetValue("12m"));
  const preset = range.preset;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError("");
    getOverview({ from: range.from || undefined, to: range.to || undefined })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load the dashboard. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  // Every drill-down carries the dashboard's current window with it.
  const summaryHref = useMemo(
    () => (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      for (const [k, v] of Object.entries(extra)) params.set(k, v);
      const qs = params.toString();
      return `/dashboard${qs ? `?${qs}` : ""}`;
    },
    [range.from, range.to]
  );

  if (isLoading && !data) return <SkeletonPage cards={3} />;
  if (!data) return <p className="detail-empty">{loadError || "Nothing to show."}</p>;

  const byStatus = data.requisitions_by_status;
  const openCount = data.open_statuses.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);
  const judged = data.requirement_met + data.requirement_unmet;
  const metPct = judged ? Math.round((data.requirement_met / judged) * 100) : null;
  const prev = data.previous_period ?? undefined;
  const months = data.monthly_trend.map((m) => m.month);
  const daily = data.trend_granularity === "day";
  const bucket = daily ? "Day" : "Month";
  const per = daily ? "day" : "month";

  const rawFirstName = (user?.name ?? user?.email ?? "there").trim().split(" ")[0];
  const firstName = rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1);

  const rangeText =
    preset === "all" || (!range.from && !range.to)
      ? "all time"
      : `${range.from ? formatDate(range.from) : "the beginning"} – ${range.to ? formatDate(range.to) : "today"}`;

  return (
    <div className="tw-reset mx-auto flex max-w-[1400px] flex-col gap-5 p-2">
      {/* Greeting + action on top; the filters that scope every widget below sit in the frosted band. */}
      <HeroHeader
        eyebrow={TODAY_LABEL}
        title={`${timeOfDayGreeting()}, ${firstName}`}
        subtitle="Requisitions, reports and deadlines at a glance"
        actions={
          <Link href="/dashboard" className="hero-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            </svg>
            Go to Testing Summary
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-3 px-9 py-5">
          <DateRangeFilter presets={OVERVIEW_PRESETS} value={range} onChange={setRange} />
          <span className="ml-auto text-xs text-text-muted">
            Showing {rangeText}
            {isLoading && " · updating…"}
          </span>
        </div>
      </HeroHeader>

      {loadError && <p className="text-sm font-medium text-neg">{loadError}</p>}

      {/* Refetch keeps the frame: the previous render dims rather than flashing a skeleton. */}
      <div className={`flex flex-col gap-5 transition-opacity ${isLoading ? "pointer-events-none opacity-60" : ""}`}>
        {/* ---- KPI cards ---- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            icon="📋"
            label="Requisitions raised"
            accent="blue"
            value={data.total_requisitions.toLocaleString()}
            deltaPct={pctChange(data.total_requisitions, prev?.total_requisitions)}
            hint={prev ? "vs previous period" : undefined}
            sparkline={data.monthly_trend.map((m) => m.raised)}
            href={summaryHref()}
          />
          <KpiCard
            icon="⏳"
            label="Open now"
            accent="amber"
            value={openCount.toLocaleString()}
            hint={`${byStatus.Pending ?? 0} pending · ${byStatus["In Testing"] ?? 0} testing · ${byStatus["Retest Needed"] ?? 0} retest`}
            href={summaryHref({ scope: "open" })}
          />
          <KpiCard
            icon="⚠️"
            label="Overdue"
            value={data.overdue_count.toLocaleString()}
            hint={`${data.due_soon_count} due in 5 days`}
            tone={data.overdue_count > 0 ? "critical" : "neutral"}
            href={summaryHref({ scope: "overdue" })}
          />
          <KpiCard
            icon="📄"
            label="Reports filed"
            accent="green"
            value={data.total_reports.toLocaleString()}
            deltaPct={pctChange(data.total_reports, prev?.total_reports)}
            hint={prev ? "vs previous period" : undefined}
            sparkline={data.monthly_trend.map((m) => m.reports)}
            href="/reports"
          />
          <KpiCard
            icon="✅"
            label="Pass rate"
            accent="green"
            value={metPct === null ? "—" : `${metPct}%`}
            hint={judged ? `${data.requirement_met} of ${judged} met` : "No judged reports"}
            href="/pumps"
          />
          <KpiCard
            icon="⏱️"
            label="Avg turnaround"
            accent="orange"
            value={data.avg_turnaround_days === null ? "—" : `${data.avg_turnaround_days.toFixed(1)}d`}
            hint="raised → closed"
            href={summaryHref({ status: "Closed" })}
          />
        </div>

        {/* ---- Trend + status ---- */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title={daily ? "Daily activity" : "Monthly activity"}
            subtitle={`Requisitions raised, reports filed and requisitions closed per ${per}${daily ? " · last 7 days at least" : ""}`}
            legend={[
              { label: "Raised", color: "var(--series-1)", shape: "line" },
              { label: "Reports filed", color: "var(--series-2)", shape: "line" },
              { label: "Closed", color: "var(--series-3)", shape: "line" },
            ]}
            table={{
              columns: [bucket, "Raised", "Reports filed", "Closed"],
              rows: data.monthly_trend.map((m) => [monthLong(m.month), m.raised, m.reports, m.closed]),
            }}
          >
            <LineChart
              months={months}
              series={[
                { key: "raised", label: "Raised", color: "var(--series-1)", values: data.monthly_trend.map((m) => m.raised) },
                { key: "reports", label: "Reports filed", color: "var(--series-2)", values: data.monthly_trend.map((m) => m.reports) },
                { key: "closed", label: "Closed", color: "var(--series-3)", values: data.monthly_trend.map((m) => m.closed) },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="Requisitions by status"
            subtitle="Click a segment to open that status"
            href={summaryHref()}
            hrefLabel="Summary"
            table={{
              columns: ["Status", "Requisitions"],
              rows: STATUS_SEGMENTS.map((s) => [s.status, byStatus[s.status] ?? 0]),
            }}
          >
            <DonutChart
              centerLabel="requisitions"
              segments={STATUS_SEGMENTS.map((s) => ({
                key: s.status,
                label: s.status,
                value: byStatus[s.status] ?? 0,
                color: s.color,
                href: summaryHref({ status: s.status }),
              }))}
            />
          </ChartCard>
        </div>

        {/* ---- Quality, category, workload ---- */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <ChartCard
            title="Requirement results"
            subtitle="Closed requisitions with a rated target"
            href="/pumps"
            hrefLabel="Compilation"
            table={{
              columns: ["Result", "Reports"],
              rows: [
                ["Met rated target", data.requirement_met],
                ["Missed rated target", data.requirement_unmet],
                ["Missed Head", data.unmet_by_parameter.head],
                ["Missed Capacity", data.unmet_by_parameter.capacity],
                ["Missed Power", data.unmet_by_parameter.power],
              ],
            }}
          >
            {judged === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">No judged reports in this range.</p>
            ) : (
              <div className="viz-root flex flex-col gap-4">
                <div>
                  <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
                    <div style={{ width: `${metPct}%`, background: "var(--status-good)" }} />
                    <div style={{ width: `${100 - (metPct ?? 0)}%`, background: "var(--status-critical)" }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="font-semibold text-pos-strong">✓ Met {data.requirement_met}</span>
                    <span className="font-semibold text-neg-strong">✕ Missed {data.requirement_unmet}</span>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Where reports miss</p>
                  <BarList
                    items={[
                      { key: "head", label: "Head", value: data.unmet_by_parameter.head },
                      { key: "capacity", label: "Capacity", value: data.unmet_by_parameter.capacity },
                      { key: "power", label: "Power", value: data.unmet_by_parameter.power },
                    ]}
                  />
                </div>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="By category"
            subtitle="Requisitions raised per category"
            table={{ columns: ["Category", "Requisitions"], rows: data.by_category.map((c) => [c.label, c.count]) }}
          >
            <BarList
              items={data.by_category.map((c) => ({
                key: c.label,
                label: c.label.replace(/^Against\s+/i, ""),
                value: c.count,
                href: c.label === "Uncategorised" ? undefined : summaryHref({ category: c.label }),
              }))}
            />
          </ChartCard>

          <ChartCard
            title="Workload"
            subtitle="Open requisitions per responsible person"
            table={{
              columns: ["Person", "Pending", "In Testing", "Retest Needed", "Total"],
              rows: data.workload.map((w) => [w.person, w.pending, w.in_testing, w.retest_needed, w.total]),
            }}
          >
            <BarList
              emptyText="No open requisitions in this range."
              items={data.workload.map((w) => ({
                key: w.person,
                label: w.person,
                value: w.total,
                detail: `${w.pending} pending · ${w.in_testing} in testing · ${w.retest_needed} retest needed`,
                href: w.person === "Unassigned" ? undefined : summaryHref({ responsible_person: w.person, scope: "open" }),
              }))}
            />
          </ChartCard>
        </div>

        {/* ---- Matrix + source team ---- */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title={`Category × ${per}`}
            subtitle="Where requisitions came from over time · click a cell to open it"
            table={{
              columns: ["Category", ...data.category_matrix.months.map(monthLong)],
              rows: data.category_matrix.rows.map((r) => [r.category, ...r.counts]),
            }}
          >
            <Heatmap
              months={data.category_matrix.months}
              rows={data.category_matrix.rows.map((r) => ({ label: r.category, counts: r.counts }))}
              cellHref={(category, month) => {
                if (category === "Uncategorised") return null;
                const { from, to } = monthRange(month);
                const params = new URLSearchParams({ category, from, to });
                return `/dashboard?${params.toString()}`;
              }}
            />
          </ChartCard>

          <ChartCard
            title="By source team"
            subtitle="Who is raising requisitions"
            table={{ columns: ["Source team", "Requisitions"], rows: data.by_source_team.map((t) => [t.label, t.count]) }}
          >
            <BarList
              items={data.by_source_team.map((t) => ({
                key: t.label,
                label: t.label,
                value: t.count,
                href: t.label === "Unspecified" ? undefined : summaryHref({ source_team: t.label }),
              }))}
            />
          </ChartCard>
        </div>

        {/* ---- Deadlines + recent reports ---- */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title="Upcoming deadlines"
            subtitle="Open requisitions nearest their target date"
            href={summaryHref({ scope: "open" })}
            hrefLabel="All open"
          >
            {data.upcoming_deadlines.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">Nothing open in this range. 🎉</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-text-muted">
                      <th className="pb-2 font-semibold">Model</th>
                      <th className="pb-2 font-semibold">EC / Quotation No.</th>
                      <th className="pb-2 font-semibold">Responsible</th>
                      <th className="pb-2 font-semibold">Status</th>
                      <th className="pb-2 font-semibold">Target</th>
                      <th className="pb-2 text-right font-semibold">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.upcoming_deadlines.map((d) => (
                      <tr key={d.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                        <td className="py-2.5 pr-3">
                          <Link href={`/requisitions/${d.requisition_no ?? d.id}`} className="font-semibold text-accent hover:underline">
                            {d.model}
                          </Link>
                          {d.requisition_no && <div className="text-[11px] text-text-faint">{d.requisition_no}</div>}
                        </td>
                        <td className="py-2.5 pr-3">
                          {d.ec_quotation_no ? (
                            <Link
                              href={`/dashboard?${new URLSearchParams({ ec: d.ec_quotation_no }).toString()}`}
                              className="text-[13px] text-text hover:text-accent hover:underline"
                              title="Show every requisition with this EC / Quotation No."
                            >
                              {d.ec_quotation_no}
                            </Link>
                          ) : (
                            <span className="text-text-faint">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-text">{d.responsible_person ?? "—"}</td>
                        <td className="py-2.5 pr-3">
                          <span className={`status-pill status-${d.status.replace(/\s+/g, "-").toLowerCase()}`}>{d.status}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatDate(d.target_date)}
                        </td>
                        <td className="py-2.5 text-right">
                          <DeadlineBadge daysLeft={d.days_left} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Recent reports" subtitle="Latest filed test reports" href="/reports" hrefLabel="Archive">
            {data.recent_reports.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">No reports in this range.</p>
            ) : (
              <ul className="flex flex-col">
                {data.recent_reports.map((r) => (
                  <li key={r.id} className="border-t border-border first:border-t-0">
                    <Link
                      href={`/reports/${r.report_no ?? r.id}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-hover"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-text-h">{r.model}</div>
                        <div className="truncate text-[11px] text-text-muted">
                          {r.report_no ?? "—"} · {FORMAT_LABELS[r.report_format ?? "observation"]} · {formatDate(r.date)}
                        </div>
                      </div>
                      <ResultBadge unmet={r.unmet_fields} hasTarget={r.has_target} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
