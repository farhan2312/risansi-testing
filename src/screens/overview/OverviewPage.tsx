"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "../dashboard/DashboardPage.css"; // reuses .status-pill / .status-* colors
import "./OverviewPage.css";
import { getOverview } from "@/services/testingService";
import { getCurrentUser } from "@/services/session";
import type { PortalOverview } from "@/types/testing";

const STATUS_ORDER = ["Pending", "In Testing", "Retest Needed", "Closed"] as const;
const FORMAT_LABELS: Record<string, string> = {
  observation: "Observation Sheet",
  "viscosity-chart": "Viscosity Correction Chart",
};

const statusClass = (status: string) => `status-${status.replace(/\s+/g, "-").toLowerCase()}`;

/** "Good Morning" / "Good Afternoon" / "Good Evening", by local hour. */
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

const OverviewPage = () => {
  const [data, setData] = useState<PortalOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch(() => setLoadError("Could not load the overview. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <p className="detail-empty">Loading...</p>;
  if (loadError || !data) return <p className="detail-empty">{loadError || "Nothing to show."}</p>;

  const judgedTotal = data.requirement_met + data.requirement_unmet;
  const metPct = judgedTotal ? Math.round((data.requirement_met / judgedTotal) * 100) : null;

  const user = getCurrentUser();
  const rawFirstName = (user?.name ?? user?.email ?? "there").trim().split(" ")[0];
  const firstName = rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1);
  const pendingCount = data.requisitions_by_status.Pending ?? 0;

  return (
    <div className="overview-page">
      <div className="sticky-page-header">
        <h1>
          {timeOfDayGreeting()}, {firstName}.
        </h1>
        <p className="subtitle">
          {TODAY_LABEL} &middot; {data.total_requisitions} requisitions raised &middot; {pendingCount} pending
        </p>
      </div>

      <div className="overview-stats">
        <div className="overview-stat">
          <span className="stat-value">{data.total_requisitions}</span>
          <span className="stat-label">Requisitions Raised</span>
        </div>
        <div className="overview-stat">
          <span className="stat-value">{data.total_reports}</span>
          <span className="stat-label">Test Reports Filled</span>
        </div>
        <div className="overview-stat">
          <span className="stat-value">{data.total_test_points}</span>
          <span className="stat-label">Test Points Recorded</span>
        </div>
        <div className="overview-stat">
          <span className="stat-value">{data.distinct_models_tested}</span>
          <span className="stat-label">Pump Models Tested</span>
        </div>
      </div>

      <div className="overview-grid">
        <section className="overview-card">
          <h2>Requisitions by Status</h2>
          <ul className="overview-breakdown">
            {STATUS_ORDER.map((status) => (
              <li key={status}>
                <span className={`status-pill ${statusClass(status)}`}>{status}</span>
                <span className="overview-breakdown-count">{data.requisitions_by_status[status] ?? 0}</span>
              </li>
            ))}
          </ul>
          <Link href="/dashboard" className="overview-card-link">
            View Testing Summary &rarr;
          </Link>
        </section>

        <section className="overview-card">
          <h2>Reports by Format</h2>
          <ul className="overview-breakdown">
            {Object.entries(FORMAT_LABELS).map(([key, label]) => (
              <li key={key}>
                <span>{label}</span>
                <span className="overview-breakdown-count">
                  {data.reports_by_format[key as keyof typeof data.reports_by_format] ?? 0}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/reports" className="overview-card-link">
            View Report Archive &rarr;
          </Link>
        </section>

        <section className="overview-card">
          <h2>Requirement Pass Rate</h2>
          {judgedTotal === 0 ? (
            <p className="detail-empty">No closed, reported requisitions with a rated target yet.</p>
          ) : (
            <>
              <div className="overview-pass-bar">
                <div className="overview-pass-bar-fill" style={{ width: `${metPct}%` }} />
              </div>
              <ul className="overview-breakdown">
                <li>
                  <span className="overview-dot overview-dot-pos" />
                  <span>Met rated target</span>
                  <span className="overview-breakdown-count">{data.requirement_met}</span>
                </li>
                <li>
                  <span className="overview-dot overview-dot-neg" />
                  <span>Missed rated target</span>
                  <span className="overview-breakdown-count">{data.requirement_unmet}</span>
                </li>
              </ul>
              <p className="overview-pass-pct">{metPct}% of judged reports met their rated head/capacity/power.</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default OverviewPage;
