"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import "./ReportArchivePage.css";
import { listGroupedReports } from "@/services/testingService";
import type { ArchivePumpGroup } from "@/types/testing";
import { formatDate, formatNumber, motorWithKw } from "@/lib/formUtils";
import Pagination from "@/components/ui/Pagination";
import { SkeletonTableRows } from "@/components/ui/Skeleton";

const PAGE_SIZE = 50;

const ReportArchivePage = () => {
  const [pumpGroups, setPumpGroups] = useState<ArchivePumpGroup[]>([]);
  const [total, setTotal] = useState(0);
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
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    listGroupedReports(page, search || undefined)
      .then((result) => {
        if (cancelled) return;
        setPumpGroups(result.entries);
        setTotal(result.total);
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
  }, [page, search]);

  const isSearching = search.length > 0;
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
      <div className="archive-header sticky-page-header">
        <h1>Report Archive</h1>
        <input
          type="text"
          placeholder="Search by model or EC number..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="archive-search"
        />
      </div>

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
