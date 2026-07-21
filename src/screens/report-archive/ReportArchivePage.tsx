"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./ReportArchivePage.css";
import { listReports } from "@/services/testingService";
import type { ArchiveReportSummary } from "@/types/testing";

const PAGE_SIZE = 20;

interface PumpGroup {
  model: string;
  reportCount: number;
  totalPoints: number;
  latestTestDate: string;
  reports: ArchiveReportSummary[];
}

const groupByPump = (reports: ArchiveReportSummary[]): PumpGroup[] => {
  const groups = new Map<string, ArchiveReportSummary[]>();
  for (const r of reports) {
    const list = groups.get(r.model) ?? [];
    list.push(r);
    groups.set(r.model, list);
  }

  return [...groups.entries()]
    .map(([model, reports]) => {
      const dates = reports.map((r) => r.test_date ?? r.created_at.slice(0, 10));
      return {
        model,
        reportCount: reports.length,
        totalPoints: reports.reduce((sum, r) => sum + r.pointCount, 0),
        latestTestDate: dates.sort().at(-1) ?? "-",
        reports: [...reports].sort((a, b) =>
          (b.test_date ?? b.created_at).localeCompare(a.test_date ?? a.created_at)
        ),
      };
    })
    .sort((a, b) => a.model.localeCompare(b.model));
};

const ReportArchivePage = () => {
  const [reports, setReports] = useState<ArchiveReportSummary[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    listReports()
      .then((rows) => {
        if (!cancelled) setReports(rows);
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
  }, []);

  const pumpGroups = useMemo(() => groupByPump(reports), [reports]);
  const isSearching = search.trim().length > 0;

  const filteredPumps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pumpGroups;
    return pumpGroups.filter((g) => g.model.toLowerCase().includes(q));
  }, [pumpGroups, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredPumps.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedPumps = filteredPumps.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let p = Math.max(1, end - 4); p <= end; p++) pages.push(p);
    return pages;
  }, [currentPage, totalPages]);

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
      <div className="archive-header">
        <h1>Report Archive</h1>
        <input
          type="text"
          placeholder="Search by model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="archive-search"
        />
      </div>

      {error && <div className="archive-error">{error}</div>}

      {isLoading ? (
        <p className="archive-empty">Loading...</p>
      ) : filteredPumps.length === 0 ? (
        <p className="archive-empty">No pumps found.</p>
      ) : (
        <table className="archive-table">
          <thead>
            <tr>
              <th></th>
              <th>Pump Model</th>
              <th>Reports</th>
              <th>Total Test Points</th>
              <th>Latest Test Date</th>
            </tr>
          </thead>
          <tbody>
            {pagedPumps.map((g) => {
              const isOpen = isSearching || expanded.has(g.model);
              return (
                <Fragment key={g.model}>
                  <tr className="pump-row" onClick={() => toggleExpanded(g.model)}>
                    <td className="expand-toggle">{isOpen ? "−" : "+"}</td>
                    <td className="pump-model-cell">{g.model}</td>
                    <td>{g.reportCount}</td>
                    <td>{g.totalPoints}</td>
                    <td>{g.latestTestDate}</td>
                  </tr>
                  {isOpen && (
                    <tr className="pump-detail-row">
                      <td></td>
                      <td colSpan={4}>
                        <table className="nested-report-table">
                          <thead>
                            <tr>
                              <th>Report No.</th>
                              <th>Motor</th>
                              <th>Rated RPM</th>
                              <th>Rated Head</th>
                              <th>Suction</th>
                              <th>Test Date</th>
                              <th>Points</th>
                              <th>Requisition-Linked</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.reports.map((r) => (
                              <tr key={r.id}>
                                <td>
                                  <Link href={`/reports/${r.id}`}>{r.report_no ?? r.motor ?? "View report"}</Link>
                                </td>
                                <td>{r.motor ?? "-"}</td>
                                <td>{r.rated_rpm ?? "-"}</td>
                                <td>{r.rated_head ?? "-"}</td>
                                <td>{r.suction_type ?? "-"}</td>
                                <td>{r.test_date ?? r.created_at.slice(0, 10)}</td>
                                <td>{r.pointCount}</td>
                                <td>{r.requisition_id ? "Yes" : "Historical"}</td>
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
      )}

      {!isLoading && filteredPumps.length > 0 && totalPages > 1 && (
        <div className="archive-pagination">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>

          {pageNumbers[0] > 1 && (
            <>
              <button type="button" onClick={() => setPage(1)}>
                1
              </button>
              {pageNumbers[0] > 2 && <span className="archive-pagination-ellipsis">…</span>}
            </>
          )}

          {pageNumbers.map((p) => (
            <button
              key={p}
              type="button"
              className={p === currentPage ? "active" : ""}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}

          {pageNumbers.at(-1)! < totalPages && (
            <>
              {pageNumbers.at(-1)! < totalPages - 1 && (
                <span className="archive-pagination-ellipsis">…</span>
              )}
              <button type="button" onClick={() => setPage(totalPages)}>
                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>

          <span className="archive-pagination-status">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
};

export default ReportArchivePage;
