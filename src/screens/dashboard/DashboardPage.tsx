"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import "./DashboardPage.css";
import { formatDate, targetDateFor } from "@/lib/formUtils";
import { getRequisitionFilterOptions, listRequisitions, updateRequisition } from "@/services/testingService";
import { useAuth } from "@/contexts/AuthContext";
import Pagination from "@/components/ui/Pagination";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import PageHeader, { pageHeaderButton } from "@/components/ui/PageHeader";
import { RAISED_BY_GROUPS, RAISED_BY_LABELS, RAISED_BY_SHORT } from "@/lib/raisedBy";
import {
  REQUISITION_CATEGORIES,
  RESPONSIBLE_PERSONS,
  SOURCE_TEAMS,
  type RequisitionStatus,
  type TestRequisition,
} from "@/types/testing";

const ALL = "All";
const PAGE_SIZE = 25;

const STATUS_TABS: { label: string; value: RequisitionStatus | "All" }[] = [
  { label: "All", value: "All" },
  { label: "Pending", value: "Pending" },
  { label: "In Testing", value: "In Testing" },
  { label: "Retest Needed", value: "Retest Needed" },
  { label: "Closed", value: "Closed" },
];

const SCOPE_OPTIONS = [
  { value: "open", label: "Open (not closed)" },
  { value: "overdue", label: "Overdue" },
  { value: "due_soon", label: "Due in 5 days" },
] as const;

const fromQuery = (value: string | null, allowed: readonly string[]) =>
  value && allowed.includes(value) ? value : ALL;

const isoDateParam = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");

const DashboardPage = () => {
  const searchParams = useSearchParams();
  const [requisitions, setRequisitions] = useState<TestRequisition[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reportResultCounts, setReportResultCounts] = useState({ green: 0, red: 0 });
  // Lets a link like /dashboard?status=Pending (the Overview page's
  // Requisitions by Status card) land here pre-filtered, instead of always
  // opening on "All" and making the user click the tab themselves.
  const [activeStatus, setActiveStatus] = useState<RequisitionStatus | "All">(() => {
    const fromQuery = searchParams.get("status");
    return STATUS_TABS.some((t) => t.value === fromQuery) ? (fromQuery as RequisitionStatus) : "All";
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { user: loggedInUser } = useAuth();
  const canReassign = loggedInUser?.role === "testing";

  const [modelFilter, setModelFilter] = useState(ALL);
  // ecInput is the live textbox value; ecFilter is the debounced value that
  // actually drives the server fetch, so typing doesn't fire a request per
  // keystroke.
  const [ecInput, setEcInput] = useState(() => searchParams.get("ec") ?? "");
  const [ecFilter, setEcFilter] = useState(() => (searchParams.get("ec") ?? "").trim());
  // "Open" / "Overdue" / "Due in 5 days" -- Overview KPI drill-downs.
  const [scopeFilter, setScopeFilter] = useState(() => fromQuery(searchParams.get("scope"), SCOPE_OPTIONS.map((o) => o.value)));
  // Overview drill-downs (/dashboard?category=...&from=...&to=...) land here
  // pre-filtered. Only values the dropdowns actually offer are accepted, so a
  // stale or hand-edited link can never leave a select showing a blank value.
  const [categoryFilter, setCategoryFilter] = useState(() => fromQuery(searchParams.get("category"), REQUISITION_CATEGORIES));
  const [sourceTeamFilter, setSourceTeamFilter] = useState(() => fromQuery(searchParams.get("source_team"), SOURCE_TEAMS));
  // Who raised it: a Source Team account, a Testing Team account, or anyone else.
  const [raisedByFilter, setRaisedByFilter] = useState(() => fromQuery(searchParams.get("raised_by"), RAISED_BY_GROUPS));
  const [responsiblePersonFilter, setResponsiblePersonFilter] = useState(() =>
    fromQuery(searchParams.get("responsible_person"), RESPONSIBLE_PERSONS)
  );
  const [submittedByFilter, setSubmittedByFilter] = useState(ALL);
  const [retestFilter, setRetestFilter] = useState(ALL);
  // Quick "Month" pick (e.g. "2026-08") -- a shortcut for the common case of
  // "show me last month's requisitions" without having to work out exact
  // From/To dates. Combines (AND) with the From/To range below when both
  // are set, same as every other filter here.
  const [monthFilter, setMonthFilter] = useState(ALL);
  const [dateFrom, setDateFrom] = useState(() => isoDateParam(searchParams.get("from")));
  const [dateTo, setDateTo] = useState(() => isoDateParam(searchParams.get("to")));
  // Only meaningful once a single Category is selected -- a second-level
  // filter for how many of that category's filled reports met their rated
  // requirements vs didn't ("Red").
  // Also seeded from ?report_result= (the Overview's Met / Missed links).
  const [reportResultFilter, setReportResultFilter] = useState<"All" | "Green" | "Red">(() => {
    const fromQuery = searchParams.get("report_result");
    return fromQuery === "green" ? "Green" : fromQuery === "red" ? "Red" : "All";
  });

  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [submittedByOptions, setSubmittedByOptions] = useState<string[]>([]);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);

  const hasActiveFilters =
    modelFilter !== ALL ||
    ecFilter.trim() !== "" ||
    scopeFilter !== ALL ||
    categoryFilter !== ALL ||
    sourceTeamFilter !== ALL ||
    raisedByFilter !== ALL ||
    responsiblePersonFilter !== ALL ||
    submittedByFilter !== ALL ||
    retestFilter !== ALL ||
    monthFilter !== ALL ||
    dateFrom !== "" ||
    dateTo !== "" ||
    reportResultFilter !== "All";

  const clearFilters = () => {
    setModelFilter(ALL);
    setEcInput("");
    setEcFilter("");
    setScopeFilter(ALL);
    setCategoryFilter(ALL);
    setSourceTeamFilter(ALL);
    setRaisedByFilter(ALL);
    setResponsiblePersonFilter(ALL);
    setSubmittedByFilter(ALL);
    setRetestFilter(ALL);
    setMonthFilter(ALL);
    setDateFrom("");
    setDateTo("");
    setReportResultFilter("All");
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setReportResultFilter("All");
  };

  const handleReassign = async (id: string, responsiblePerson: string) => {
    try {
      const updated = await updateRequisition(id, { responsible_person: responsiblePerson });
      setRequisitions((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      setError("Could not update responsible person. Please try again.");
    }
  };

  // Debounces the free-text EC/Quotation No. field -- everything else
  // (dropdowns, dates) applies immediately on change, same as before.
  useEffect(() => {
    const t = setTimeout(() => setEcFilter(ecInput.trim()), 300);
    return () => clearTimeout(t);
  }, [ecInput]);

  // Any filter (or the status tab) changing invalidates whatever page we
  // were on -- always land back on page 1 rather than a now-meaningless
  // page number against the new, narrower result set.
  useEffect(() => {
    setPage(1);
  }, [
    activeStatus,
    modelFilter,
    ecFilter,
    scopeFilter,
    categoryFilter,
    sourceTeamFilter,
    raisedByFilter,
    responsiblePersonFilter,
    submittedByFilter,
    retestFilter,
    monthFilter,
    dateFrom,
    dateTo,
    reportResultFilter,
  ]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    listRequisitions(activeStatus === "All" ? undefined : activeStatus, page, {
      model: modelFilter === ALL ? undefined : modelFilter,
      ec_quotation_no: ecFilter || undefined,
      scope: scopeFilter === ALL ? undefined : (scopeFilter as (typeof SCOPE_OPTIONS)[number]["value"]),
      category: categoryFilter === ALL ? undefined : categoryFilter,
      source_team: sourceTeamFilter === ALL ? undefined : sourceTeamFilter,
      raised_by: raisedByFilter === ALL ? undefined : (raisedByFilter as (typeof RAISED_BY_GROUPS)[number]),
      responsible_person: responsiblePersonFilter === ALL ? undefined : responsiblePersonFilter,
      submitted_by: submittedByFilter === ALL ? undefined : submittedByFilter,
      retest_needed: retestFilter === ALL ? undefined : retestFilter === "Yes" ? "true" : "false",
      month: monthFilter === ALL ? undefined : monthFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      report_result:
        reportResultFilter === "All" ? undefined : reportResultFilter === "Green" ? "green" : "red",
    })
      .then((result) => {
        if (cancelled) return;
        setRequisitions(result.entries);
        setTotal(result.total);
        if (result.report_result_counts) setReportResultCounts(result.report_result_counts);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load testing summaries.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeStatus,
    page,
    modelFilter,
    ecFilter,
    scopeFilter,
    categoryFilter,
    sourceTeamFilter,
    raisedByFilter,
    responsiblePersonFilter,
    submittedByFilter,
    retestFilter,
    monthFilter,
    dateFrom,
    dateTo,
    reportResultFilter,
  ]);

  // Filter-bar dropdown options depend only on the status tab, not the
  // other filters (matches the pre-pagination behavior) -- fetched
  // separately since the row list itself is now just one page of 25.
  useEffect(() => {
    let cancelled = false;
    getRequisitionFilterOptions(activeStatus === "All" ? undefined : activeStatus)
      .then((opts) => {
        if (cancelled) return;
        setModelOptions(opts.models);
        setSubmittedByOptions(opts.submitted_by);
        setMonthOptions(opts.months);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeStatus]);

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-");
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
      new Date(Number(y), Number(m) - 1, 1)
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const emptyMessage = hasActiveFilters
    ? "No testing summaries match these filters."
    : "No testing summaries in this status.";

  return (
    <div className="dashboard-page">
      <PageHeader
        icon="📋"
        title="Testing Summary"
        actions={
          <Link href="/requisitions/new" className={pageHeaderButton("primary")}>
            <span aria-hidden="true">+</span> New Requisition
          </Link>
        }
      />

      <div className="status-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={activeStatus === tab.value ? "active" : ""}
            onClick={() => setActiveStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
          <option value={ALL}>All Models</option>
          {modelOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by EC/Quotation No..."
          value={ecInput}
          onChange={(e) => setEcInput(e.target.value)}
        />
        <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
          <option value={ALL}>All Deadlines</option>
          {SCOPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(e) => handleCategoryChange(e.target.value)}>
          <option value={ALL}>All Categories</option>
          {REQUISITION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={raisedByFilter} onChange={(e) => setRaisedByFilter(e.target.value)} aria-label="Raised by">
          <option value={ALL}>Raised By: Anyone</option>
          {RAISED_BY_GROUPS.map((g) => (
            <option key={g} value={g}>
              Raised By: {RAISED_BY_LABELS[g]}
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
        {hasActiveFilters && (
          <button type="button" className="clear-filters-btn" onClick={clearFilters}>
            ✕ Clear Filters
          </button>
        )}
      </div>

      {(categoryFilter !== ALL || activeStatus === "Closed" || reportResultFilter !== "All") && (
        <div className="report-result-filter">
          <span className="report-result-label">
            Reports filled{categoryFilter !== ALL ? ` for "${categoryFilter}"` : ""}: {reportResultCounts.green + reportResultCounts.red}
          </span>
          <button
            type="button"
            className={`report-result-pill ${reportResultFilter === "All" ? "active" : ""}`}
            onClick={() => setReportResultFilter("All")}
          >
            All ({reportResultCounts.green + reportResultCounts.red})
          </button>
          <button
            type="button"
            className={`report-result-pill green ${reportResultFilter === "Green" ? "active" : ""}`}
            onClick={() => setReportResultFilter("Green")}
          >
            Met ({reportResultCounts.green})
          </button>
          <button
            type="button"
            className={`report-result-pill red ${reportResultFilter === "Red" ? "active" : ""}`}
            onClick={() => setReportResultFilter("Red")}
          >
            Not Met ({reportResultCounts.red})
          </button>
        </div>
      )}

      {error && <div className="dashboard-error">{error}</div>}

      {!isLoading && requisitions.length === 0 ? (
        <p className="dashboard-empty">{emptyMessage}</p>
      ) : (
        <table className="requisition-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Category</th>
              <th>EC/Quotation No.</th>
              <th>RES.</th>
              <th>Source Team</th>
              <th>Date of Requisition</th>
              <th>Target Date</th>
              <th>Retest Needed</th>
              <th>Submitted By</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTableRows columns={10} />}
            {!isLoading && requisitions.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/requisitions/${r.requisition_no ?? r.id}`}>{r.model}</Link>
                </td>
                <td>{r.category ?? "-"}</td>
                <td>{r.ec_quotation_no ?? "-"}</td>
                <td>
                  {canReassign ? (
                    <select
                      className="res-reassign-select"
                      value={r.responsible_person ?? ""}
                      onChange={(e) => handleReassign(r.id, e.target.value)}
                    >
                      <option value="" disabled>
                        -
                      </option>
                      {RESPONSIBLE_PERSONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  ) : (
                    r.responsible_person ?? "-"
                  )}
                </td>
                <td>{r.source_team ?? "-"}</td>
                <td>{formatDate(r.date_of_requisition)}</td>
                <td>
                  {(() => {
                    const target = targetDateFor(r);
                    if (!target) return "-";
                    return (
                      <>
                        {formatDate(target.date)}
                        {target.isAuto && <span className="target-date-auto-hint"> (auto)</span>}
                      </>
                    );
                  })()}
                </td>
                <td>{r.retest_needed === null ? "-" : r.retest_needed ? "Yes" : "No"}</td>
                <td>
                  {r.submitted_by ?? "-"}
                  {r.raised_by_group && (
                    <span className={`raised-by-badge raised-by-${r.raised_by_group}`} title={RAISED_BY_LABELS[r.raised_by_group]}>
                      {RAISED_BY_SHORT[r.raised_by_group]}
                    </span>
                  )}
                </td>
                <td>
                  {r.status === "Closed" && r.report_id ? (
                    (() => {
                      const unmetFields = r.report_requirement_unmet_fields ?? [];
                      const unmetTitle = unmetFields.length
                        ? `Outside rated ${unmetFields.join(", ")}`
                        : undefined;
                      return (
                        <span className="status-actions">
                          <Link
                            href={`/reports/${r.report_no ?? r.report_id}`}
                            className={`status-pill ${unmetTitle ? "status-view-report-unmet" : "status-view-report"}`}
                            title={unmetTitle}
                          >
                            View Report{unmetTitle && " ⚠"}
                          </Link>
                          <Link href={`/reports/${r.report_no ?? r.report_id}/curve`} className="status-pill status-view-curve">
                            View Curve
                          </Link>
                        </span>
                      );
                    })()
                  ) : (
                    <span className={`status-pill status-${r.status.replace(/\s+/g, "-").toLowerCase()}`}>
                      {r.status}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
};

export default DashboardPage;
