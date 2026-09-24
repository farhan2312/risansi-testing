"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import "./ReportArchivePage.css";
import { listGroupedReports } from "@/services/testingService";
import type { ArchivePumpGroup } from "@/types/testing";
import { formatDate, formatNumber, motorWithKw } from "@/lib/formUtils";
import Pagination from "@/components/ui/Pagination";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import PageHeader from "@/components/ui/PageHeader";

const PAGE_SIZE = 50;

const dayParam = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");

const ReportArchivePage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Arriving from the Overview's "Reports filed" card (?from=&to=) narrows the
  // archive to reports tested inside that window, so the list matches the
  // number on the card. Cleared with the chip below (which drops the params).
  const dateFrom = dayParam(searchParams.get("from"));
  const dateTo = dayParam(searchParams.get("to"));
  const hasRange = Boolean(dateFrom || dateTo);

  const [pumpGroups, setPumpGroups] = useState<ArchivePumpGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [totalReports, setTotalReports] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  // Debounces the search box -- server-side now, so typing shouldn't fire a
  // request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    listGroupedReports(page, search || undefined, { from: dateFrom || undefined, to: dateTo || undefined })
      .then((result) => {
        if (cancelled) return;
        setPumpGroups(result.entries);
        setTotal(result.total);
        setTotalReports(result.total_reports);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load reports.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, search, dateFrom, dateTo]);

  // With a range or a search active the point is to see the matching reports,
  // so every pump on the page opens instead of needing a click each.
  const isSearching = search.length > 0 || hasRange;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleExpanded = (model: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  };

  return (
    <div className="archive-page">
      <PageHeader
        icon="📄"
        title="Report Archive"
        subtitle="Every test report, grouped by pump · open a row to preview or download its reports."
        actions={
          <input
            type="text"
            placeholder="Search by model or EC number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="archive-search"
          />
        }
      />

      {hasRange && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-accent-soft px-4 py-2.5 text-sm text-text">
          <span aria-hidden="true">📅</span>
          <span>
            Reports tested {dateFrom ? formatDate(dateFrom) : "from the beginning"} – {dateTo ? formatDate(dateTo) : "today"}
            {!isLoading && (
              <strong className="ml-2 text-text-h">
                {totalReports.toLocaleString()} report{totalReports === 1 ? "" : "s"} · {total.toLocaleString()} pump{total === 1 ? "" : "s"}
              </strong>
            )}
          </span>
          <button
            type="button"
            onClick={() => router.push("/reports")}
            className="ml-auto cursor-pointer rounded-lg border border-border bg-surface px-3 py-1 text-xs font-semibold text-text hover:bg-surface-hover"
          >
            ✕ Clear range
          </button>
        </div>
      )}

      {error && <div className="archive-error">{error}</div>}

      {!isLoading && pumpGroups.length === 0 ? (
        <p className="archive-empty">No pumps found.</p>
      ) : (
        <table className="archive-table">
          <thead>
            <tr>
              <th></th>
              <th>Pump Model</th>
              <th>Reports</th>
              <th>Formats</th>
              <th>Total Test Points</th>
              <th>Latest Test Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTableRows columns={6} />}
            {!isLoading && pumpGroups.map((g) => {
              const isOpen = isSearching || expanded.has(g.model);
              return (
                <Fragment key={g.model}>
                  <tr className="pump-row" onClick={() => toggleExpanded(g.model)}>
                    <td className="expand-toggle">{isOpen ? "−" : "+"}</td>
                    <td className="pump-model-cell">
                      <Link href={`/pumps/${encodeURIComponent(g.model)}`} onClick={(e) => e.stopPropagation()}>
                        {g.model}
                      </Link>
                    </td>
                    <td>{g.report_count}</td>
                    <td>
                      <span className={`format-badge ${g.has_observation ? "present" : "missing"}`}>Obs</span>
                      <span className={`format-badge ${g.has_viscosity_chart ? "present" : "missing"}`}>VC</span>
                    </td>
                    <td>{g.total_points}</td>
                    <td>{formatDate(g.latest_test_date)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="pump-detail-row">
                      <td></td>
                      <td colSpan={5}>
                        <table className="nested-report-table">
                          <thead>
                            <tr>
                              <th>Report No.</th>
                              <th>Motor</th>
                              <th>Test Date</th>
                              <th>Rated Capacity</th>
                              <th>Rated Head</th>
                              <th>Rated RPM</th>
                              <th>Rated KW</th>
                              <th>Points</th>
                              <th>Max VE</th>
                              <th>Max ME</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.reports.map((r) => {
                              const unmetFields = r.requirement_unmet_fields ?? [];
                              const unmetTitle = unmetFields.length
                                ? `Outside rated ${unmetFields.join(", ")}`
                                : "";
                              return (
                                <tr key={r.id} className={unmetTitle ? "requirement-row-not-met" : ""} title={unmetTitle || undefined}>
                                  <td>
                                    <Link href={`/reports/${r.report_no ?? r.id}`}>{r.report_no ?? r.motor ?? "View report"}</Link>
                                    {unmetTitle && <span className="requirement-flag">⚠</span>}
                                  </td>
                                  <td>{motorWithKw(r.motor)}</td>
                                  <td>{formatDate(r.test_date ?? r.created_at)}</td>
                                  <td>{formatNumber(r.rated_capacity)}</td>
                                  <td>{formatNumber(r.rated_head)}</td>
                                  <td>{formatNumber(r.rated_rpm)}</td>
                                  <td>{formatNumber(r.rated_power_kw)}</td>
                                  <td>{r.pointCount}</td>
                                  <td>{r.max_ve !== null ? `${r.max_ve.toFixed(1)}%` : "-"}</td>
                                  <td>{r.max_me !== null ? `${r.max_me.toFixed(1)}%` : "-"}</td>
                                  <td>
                                    <Link href={`/reports/${r.report_no ?? r.id}/curve`}>View Curve</Link>
                                  </td>
                                </tr>
                              );
                            })}
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
      )}

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
};

export default ReportArchivePage;
