"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "../dashboard/DashboardPage.css";
import "./PumpIndexPage.css";
import { modelDisplayLabel, normalizeModelKey } from "@/lib/modelKey";
import { listReports, listRequisitions } from "@/services/testingService";
import type { ArchiveReportSummary, TestRequisition } from "@/types/testing";
import { formatDate } from "@/lib/formUtils";

interface PumpIndexRow {
  model: string;
  reportCount: number;
  requisitionCount: number;
  latestDate: string;
  reports: ArchiveReportSummary[];
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

const PumpIndexPage = () => {
  const [reports, setReports] = useState<ArchiveReportSummary[]>([]);
  const [requisitions, setRequisitions] = useState<TestRequisition[]>([]);
  const [search, setSearch] = useState("");
  const [statFilter, setStatFilter] = useState<StatFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
      };
    });

    return rows.sort((a, b) => a.model.localeCompare(b.model));
  }, [reports, requisitions]);

  const filteredPumps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pumps
      .filter((p) => pumpMatchesFilter(p.reports, statFilter))
      .filter((p) => !q || p.model.toLowerCase().includes(q));
  }, [pumps, search, statFilter]);

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
        <h1>Pump Dashboard</h1>
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
              <th>Pump Model</th>
              <th>Requisitions</th>
              <th>Test Reports</th>
              <th>Latest Activity</th>
            </tr>
          </thead>
          <tbody>
            {filteredPumps.map((p) => (
              <tr key={p.model}>
                <td>
                  <Link href={`/pumps/${encodeURIComponent(p.model)}`}>{p.model}</Link>
                </td>
                <td>{p.requisitionCount}</td>
                <td>{p.reportCount}</td>
                <td>{formatDate(p.latestDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PumpIndexPage;
