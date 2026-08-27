"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "../dashboard/DashboardPage.css";
import "../report-archive/ReportArchivePage.css"; // reuses .pump-row/.expand-toggle/.nested-report-table
import "./PumpIndexPage.css";
import { modelDisplayLabel, normalizeModelKey } from "@/lib/modelKey";
import { listReports, listRequisitions } from "@/services/testingService";
import {
  REQUISITION_CATEGORIES,
  RESPONSIBLE_PERSONS,
  SOURCE_TEAMS,
  type ArchiveReportSummary,
  type TestRequisition,
} from "@/types/testing";
import { formatDate } from "@/lib/formUtils";

const ALL = "All";

interface PumpIndexRow {
  model: string;
  reportCount: number;
  requisitionCount: number;
  latestDate: string;
  reports: ArchiveReportSummary[];
  requisitions: TestRequisition[];
}

/** Which stat tile is currently narrowing the pump list -- "all" for the two
 * plain totals (Pump Models / Reports Submitted), which just mean "no filter". */
type StatFilter = "all" | "historical" | "met" | "unmet";

const hasTarget = (r: ArchiveReportSummary) =>
  r.rated_head !== null || r.rated_capacity !== null || r.rated_power_kw !== null;

/** Same per-report rules the stat tiles themselves are counted with -- a pump
 * "matches" a filter if at least one of its reports qualifies. */
const pumpMatchesFilter = (reports: ArchiveReportSummary[], filter: StatFilter): boolean => {
  if (filter === "all") return true;
  if (filter === "historical") return reports.some((r) => r.prepared_by === "Legacy Import");
  if (filter === "met") return reports.some((r) => hasTarget(r) && r.requirement_unmet_fields.length === 0);
  return reports.some((r) => hasTarget(r) && r.requirement_unmet_fields.length > 0); // "unmet"
};

/** A pump's own reports that actually satisfy the active filter -- a pump
 * can have reports on both sides (some met, some didn't), so "matches the
 * filter" alone doesn't tell you that split. Backs both the count column
 * and the expanded "View Report" list below each row. */
const matchingReports = (reports: ArchiveReportSummary[], filter: StatFilter): ArchiveReportSummary[] => {
  if (filter === "all") return reports;
  if (filter === "historical") return reports.filter((r) => r.prepared_by === "Legacy Import");
  if (filter === "met") return reports.filter((r) => hasTarget(r) && r.requirement_unmet_fields.length === 0);
  return reports.filter((r) => hasTarget(r) && r.requirement_unmet_fields.length > 0); // "unmet"
};

const PumpIndexPage = () => {
  const [reports, setReports] = useState<ArchiveReportSummary[]>([]);
  const [requisitions, setRequisitions] = useState<TestRequisition[]>([]);
  const [search, setSearch] = useState("");
  const [statFilter, setStatFilter] = useState<StatFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Same requisition-level filters as the Testing Summary page, applied here
  // so a pump only shows up if it has a requisition matching every active
  // one -- lets you narrow the Pump Dashboard the same way, e.g. "which
  // pumps has Research raised in August".
  const [ecFilter, setEcFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [sourceTeamFilter, setSourceTeamFilter] = useState(ALL);
  const [responsiblePersonFilter, setResponsiblePersonFilter] = useState(ALL);
  const [submittedByFilter, setSubmittedByFilter] = useState(ALL);
  const [retestFilter, setRetestFilter] = useState(ALL);
  const [monthFilter, setMonthFilter] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const toggleExpanded = (model: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    Promise.all([listReports(), listRequisitions()])
      .then(([r, req]) => {
        if (cancelled) return;
        setReports(r);
        setRequisitions(req);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load pumps.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const pumps = useMemo(() => {
    const groups = new Map<string, { reports: ArchiveReportSummary[]; requisitions: TestRequisition[] }>();
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

    const rows: PumpIndexRow[] = [...groups.values()].map((g) => {
      const dates = [
        ...g.reports.map((r) => r.test_date ?? r.created_at.slice(0, 10)),
        ...g.requisitions.map((r) => r.created_at.slice(0, 10)),
      ];
      return {
        model: modelDisplayLabel([...g.reports, ...g.requisitions]),
        reportCount: g.reports.length,
        requisitionCount: g.requisitions.length,
        latestDate: dates.sort().at(-1) ?? "-",
        reports: g.reports,
        requisitions: g.requisitions,
      };
    });

    return rows.sort((a, b) => a.model.localeCompare(b.model));
  }, [reports, requisitions]);

  const submittedByOptions = useMemo(
    () =>
      [...new Set(requisitions.map((r) => r.submitted_by).filter((v): v is string => Boolean(v)))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [requisitions]
  );

  // Every distinct calendar month a requisition was raised in, newest first.
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    for (const r of requisitions) {
      if (r.date_of_requisition) months.add(r.date_of_requisition.slice(0, 7));
    }
    return [...months].sort().reverse();
  }, [requisitions]);

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-");
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
      new Date(Number(y), Number(m) - 1, 1)
    );
  };

  const requisitionMatchesFilters = (r: TestRequisition): boolean => {
    const ec = ecFilter.trim().toLowerCase();
    if (ec && !(r.ec_quotation_no ?? "").toLowerCase().includes(ec)) return false;
    if (categoryFilter !== ALL && r.category !== categoryFilter) return false;
    if (sourceTeamFilter !== ALL && r.source_team !== sourceTeamFilter) return false;
    if (responsiblePersonFilter !== ALL && r.responsible_person !== responsiblePersonFilter) return false;
    if (submittedByFilter !== ALL && r.submitted_by !== submittedByFilter) return false;
    if (retestFilter !== ALL) {
      if (retestFilter === "Yes" && r.retest_needed !== true) return false;
      if (retestFilter === "No" && r.retest_needed !== false) return false;
    }
    if (monthFilter !== ALL && r.date_of_requisition?.slice(0, 7) !== monthFilter) return false;
    if (dateFrom && (!r.date_of_requisition || r.date_of_requisition < dateFrom)) return false;
    if (dateTo && (!r.date_of_requisition || r.date_of_requisition > dateTo)) return false;
    return true;
  };

  const hasActiveReqFilters =
    ecFilter.trim() !== "" ||
    categoryFilter !== ALL ||
    sourceTeamFilter !== ALL ||
    responsiblePersonFilter !== ALL ||
    submittedByFilter !== ALL ||
    retestFilter !== ALL ||
    monthFilter !== ALL ||
    dateFrom !== "" ||
    dateTo !== "";

  const clearReqFilters = () => {
    setEcFilter("");
    setCategoryFilter(ALL);
    setSourceTeamFilter(ALL);
    setResponsiblePersonFilter(ALL);
    setSubmittedByFilter(ALL);
    setRetestFilter(ALL);
    setMonthFilter(ALL);
    setDateFrom("");
    setDateTo("");
  };

  const filteredPumps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pumps
      .filter((p) => pumpMatchesFilter(p.reports, statFilter))
      .filter((p) => !hasActiveReqFilters || p.requisitions.some(requisitionMatchesFilters))
      .filter((p) => !q || p.model.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pumps,
    search,
    statFilter,
    hasActiveReqFilters,
    ecFilter,
    categoryFilter,
    sourceTeamFilter,
    responsiblePersonFilter,
    submittedByFilter,
    retestFilter,
    monthFilter,
    dateFrom,
    dateTo,
  ]);

  const STAT_LABELS: Record<Exclude<StatFilter, "all">, string> = {
    historical: "Historical Reports",
    met: "Met Requirement",
    unmet: "Did Not Meet Requirement",
  };

  // Legacy-imported reports (see CLAUDE.md's "Legacy data import") vs ones
  // actually filled in through the live app -- a real, useful distinction
  // for a dashboard that mixes decades of bulk-imported history with fresh
  // testing. Met/Did Not Meet only counts reports that actually have a rated
  // head/capacity/power to judge against -- nothing to compare, not counted
  // either way, same rule the report list itself uses per-row.
  const summary = useMemo(() => {
    let historical = 0;
    let met = 0;
    let unmet = 0;
    for (const r of reports) {
      if (r.prepared_by === "Legacy Import") historical++;
      const hasTarget = r.rated_head !== null || r.rated_capacity !== null || r.rated_power_kw !== null;
      if (!hasTarget) continue;
      if (r.requirement_unmet_fields.length > 0) unmet++;
      else met++;
    }
    return { total: reports.length, historical, met, unmet, pumpCount: pumps.length };
  }, [reports, pumps]);

  return (
    <div className="pump-index-page">
      <div className="pump-index-header sticky-page-header">
        <h1>Report Compilation</h1>
        <input
          type="text"
          placeholder="Search by model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pump-index-search"
        />
      </div>

      {!isLoading && !error && (
        <div className="pump-index-stats">
          <button
            type="button"
            className="pump-index-stat pump-index-stat-btn"
            onClick={() => setStatFilter("all")}
          >
            <span className="stat-value">{summary.pumpCount}</span>
            <span className="stat-label">Pump Models</span>
          </button>
          <button
            type="button"
            className="pump-index-stat pump-index-stat-btn"
            onClick={() => setStatFilter("all")}
          >
            <span className="stat-value">{summary.total}</span>
            <span className="stat-label">Reports Submitted</span>
          </button>
          <button
            type="button"
            className={`pump-index-stat pump-index-stat-btn ${statFilter === "historical" ? "active" : ""}`}
            onClick={() => setStatFilter((f) => (f === "historical" ? "all" : "historical"))}
          >
            <span className="stat-value">{summary.historical}</span>
            <span className="stat-label">Historical Reports</span>
          </button>
          <button
            type="button"
            className={`pump-index-stat pump-index-stat-btn ${statFilter === "met" ? "active" : ""}`}
            onClick={() => setStatFilter((f) => (f === "met" ? "all" : "met"))}
          >
            <span className="stat-value stat-value-pos">{summary.met}</span>
            <span className="stat-label">Met Requirement</span>
          </button>
          <button
            type="button"
            className={`pump-index-stat pump-index-stat-btn ${statFilter === "unmet" ? "active" : ""}`}
            onClick={() => setStatFilter((f) => (f === "unmet" ? "all" : "unmet"))}
          >
            <span className="stat-value stat-value-neg">{summary.unmet}</span>
            <span className="stat-label">Did Not Meet Requirement</span>
          </button>
        </div>
      )}

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Filter by EC/Quotation No..."
          value={ecFilter}
          onChange={(e) => setEcFilter(e.target.value)}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value={ALL}>All Categories</option>
          {REQUISITION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={sourceTeamFilter} onChange={(e) => setSourceTeamFilter(e.target.value)}>
          <option value={ALL}>All Source Teams</option>
          {SOURCE_TEAMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={responsiblePersonFilter} onChange={(e) => setResponsiblePersonFilter(e.target.value)}>
          <option value={ALL}>All Responsible Persons</option>
          {RESPONSIBLE_PERSONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={submittedByFilter} onChange={(e) => setSubmittedByFilter(e.target.value)}>
          <option value={ALL}>All Submitted By</option>
          {submittedByOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={retestFilter} onChange={(e) => setRetestFilter(e.target.value)}>
          <option value={ALL}>Retest Needed: All</option>
          <option value="Yes">Retest Needed: Yes</option>
          <option value="No">Retest Needed: No</option>
        </select>
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value={ALL}>All Months</option>
          {monthOptions.map((ym) => (
            <option key={ym} value={ym}>
              {monthLabel(ym)}
            </option>
          ))}
        </select>
        <label className="filter-date-field">
          From
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="filter-date-field">
          To
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        {hasActiveReqFilters && (
          <button type="button" className="clear-filters-btn" onClick={clearReqFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {statFilter !== "all" && (
        <p className="pump-index-filter-note">
          Showing pumps with at least one report that {statFilter === "historical" ? "is a historical import" : statFilter === "met" ? "met its rated requirement" : "did not meet its rated requirement"} ({STAT_LABELS[statFilter]}).{" "}
          <button type="button" className="pump-index-filter-clear" onClick={() => setStatFilter("all")}>
            Clear filter
          </button>
        </p>
      )}

      {error && <div className="dashboard-error">{error}</div>}

      {isLoading ? (
        <p className="dashboard-empty">Loading...</p>
      ) : filteredPumps.length === 0 ? (
        <p className="dashboard-empty">No pumps found.</p>
      ) : (
        <table className="requisition-table">
          <thead>
            <tr>
              <th></th>
              <th>Pump Model</th>
              <th>Requisitions</th>
              <th>Test Reports</th>
              {statFilter !== "all" && <th>{STAT_LABELS[statFilter]}</th>}
              <th>Latest Activity</th>
            </tr>
          </thead>
          <tbody>
            {filteredPumps.map((p) => {
              const isOpen = expanded.has(p.model);
              // With a KPI filter active, expanding shows just the reports
              // that satisfy it (the whole point of "how many were met") --
              // with no filter, every report for the pump.
              const rowsToShow = [...matchingReports(p.reports, statFilter)].sort((a, b) =>
                (b.test_date ?? b.created_at).localeCompare(a.test_date ?? a.created_at)
              );
              const matchingRequisitionCount = hasActiveReqFilters
                ? p.requisitions.filter(requisitionMatchesFilters).length
                : p.requisitionCount;
              return (
                <Fragment key={p.model}>
                  <tr className="pump-row" onClick={() => toggleExpanded(p.model)}>
                    <td className="expand-toggle">{isOpen ? "−" : "+"}</td>
                    <td className="pump-model-cell">
                      <Link href={`/pumps/${encodeURIComponent(p.model)}`} onClick={(e) => e.stopPropagation()}>
                        {p.model}
                      </Link>
                    </td>
                    <td title={hasActiveReqFilters ? `${matchingRequisitionCount} of ${p.requisitionCount} match the filters` : undefined}>
                      {hasActiveReqFilters ? `${matchingRequisitionCount} of ${p.requisitionCount}` : p.requisitionCount}
                    </td>
                    <td>{p.reportCount}</td>
                    {statFilter !== "all" && (
                      <td
                        className={
                          statFilter === "met"
                            ? "pump-index-match-pos"
                            : statFilter === "unmet"
                              ? "pump-index-match-neg"
                              : ""
                        }
                      >
                        {rowsToShow.length} of {p.reportCount}
                      </td>
                    )}
                    <td>{formatDate(p.latestDate)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="pump-detail-row">
                      <td></td>
                      <td colSpan={statFilter !== "all" ? 5 : 4}>
                        {rowsToShow.length === 0 ? (
                          <p className="dashboard-empty">No reports match this filter for {p.model}.</p>
                        ) : (
                          <table className="nested-report-table">
                            <thead>
                              <tr>
                                <th>Report No.</th>
                                <th>Test Date</th>
                                <th>Points</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {rowsToShow.map((r) => {
                                const unmetFields = r.requirement_unmet_fields ?? [];
                                const unmetTitle = unmetFields.length
                                  ? `Outside rated ${unmetFields.join(", ")}`
                                  : "";
                                return (
                                  <tr key={r.id}>
                                    <td>{r.report_no ?? r.motor ?? "-"}</td>
                                    <td>{formatDate(r.test_date ?? r.created_at)}</td>
                                    <td>{r.pointCount}</td>
                                    <td>
                                      <span className="status-actions">
                                        <Link
                                          href={`/reports/${r.id}`}
                                          className={`status-pill ${unmetTitle ? "status-view-report-unmet" : "status-view-report"}`}
                                          title={unmetTitle || undefined}
                                        >
                                          View Report{unmetTitle && " ⚠"}
                                        </Link>
                                        <Link href={`/reports/${r.id}/curve`} className="status-pill status-view-curve">
                                          View Curve
                                        </Link>
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PumpIndexPage;
