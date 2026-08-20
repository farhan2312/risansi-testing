"use client";

import { useEffect, useState } from "react";
import "./AdminAccessRequestsPage.css";
import "./AdminBugReportsPage.css"; // reuses .bug-status-tab pill styling
import "./AdminAuditLogPage.css";
import {
  getAuditActivity,
  getAuditSessions,
  getAuditSummary,
  getAuditUsage,
} from "@/services/adminService";
import type {
  AuditActivityEntry,
  AuditRange,
  AuditSessionEntry,
  AuditSummary,
  AuditUsageRow,
} from "@/types/testing";

type Tab = "usage" | "sessions" | "activity";

const RANGE_TABS: { label: string; value: AuditRange }[] = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7days" },
  { label: "30 days", value: "30days" },
  { label: "All", value: "all" },
];

/** "15h 04m" / "30m 32s" / "8s" -- matches the works-sheet convention of
 * dropping to the next-smaller unit rather than always showing h/m/s. */
const formatDuration = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
};

const eventLabel: Record<string, string> = {
  login: "Login",
  login_failed: "Failed Login",
  logout: "Logout",
  create: "Created",
  update: "Updated",
  delete: "Deleted",
};

const eventClass = (eventType: string) => `audit-event audit-event-${eventType.replace(/_/g, "-")}`;

const AdminAuditLogPage = () => {
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [tab, setTab] = useState<Tab>("usage");
  const [range, setRange] = useState<AuditRange>("7days");
  const [usage, setUsage] = useState<AuditUsageRow[]>([]);
  const [sessions, setSessions] = useState<AuditSessionEntry[]>([]);
  const [activity, setActivity] = useState<AuditActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAuditSummary()
      .then(setSummary)
      .catch(() => setError("Could not load the summary."));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError("");
    const loader =
      tab === "usage"
        ? getAuditUsage(range).then(setUsage)
        : tab === "sessions"
        ? getAuditSessions(range).then(setSessions)
        : getAuditActivity(range).then(setActivity);
    loader.catch(() => setError("Could not load this tab.")).finally(() => setIsLoading(false));
  }, [tab, range]);

  const totalActiveTime = usage.reduce((sum, r) => sum + r.active_seconds, 0);

  return (
    <div className="admin-requests-page">
      <div className="admin-requests-header sticky-page-header">
        <h1>Audit Log</h1>
        <p>Full activity trail — who signed in, when, and everything they did.</p>
      </div>

      <div className="audit-stats">
        <div className="audit-stat">
          <span className="stat-value">{summary?.logins_24h ?? "-"}</span>
          <span className="stat-label">Logins · 24H</span>
        </div>
        <div className="audit-stat">
          <span className="stat-value stat-value-neg">{summary?.failed_24h ?? "-"}</span>
          <span className="stat-label">Failed · 24H</span>
        </div>
        <div className="audit-stat">
          <span className="stat-value">{summary?.active_users_24h ?? "-"}</span>
          <span className="stat-label">Active Users · 24H</span>
        </div>
        <div className="audit-stat">
          <span className="stat-value">{summary?.actions_24h ?? "-"}</span>
          <span className="stat-label">Actions · 24H</span>
        </div>
      </div>

      <div className="bug-status-tabs audit-tab-row">
        <button type="button" className={tab === "usage" ? "bug-status-tab active" : "bug-status-tab"} onClick={() => setTab("usage")}>
          Usage &amp; Time
        </button>
        <button type="button" className={tab === "sessions" ? "bug-status-tab active" : "bug-status-tab"} onClick={() => setTab("sessions")}>
          Logins &amp; Sessions
        </button>
        <button type="button" className={tab === "activity" ? "bug-status-tab active" : "bug-status-tab"} onClick={() => setTab("activity")}>
          Activity
        </button>
      </div>

      <div className="audit-range-row">
        {RANGE_TABS.map((r) => (
          <button
            key={r.value}
            type="button"
            className={range === r.value ? "audit-range-btn active" : "audit-range-btn"}
            onClick={() => setRange(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading && <p>Loading...</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && tab === "usage" && (
        <>
          <p className="audit-tab-subline">
            {usage.length} users active · {formatDuration(totalActiveTime)} total active time
          </p>
          {usage.length === 0 ? (
            <p className="empty-state">No activity in this range.</p>
          ) : (
            <table className="admin-requests-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Active Time</th>
                  <th>Sessions</th>
                  <th>Pages</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((r) => (
                  <tr key={r.user_id}>
                    <td>{r.user_email ?? r.user_name ?? "-"}</td>
                    <td>
                      <strong>{formatDuration(r.active_seconds)}</strong>
                    </td>
                    <td>{r.session_count}</td>
                    <td>{r.page_count}</td>
                    <td>{new Date(r.last_active).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {!isLoading && !error && tab === "sessions" && (
        <>
          {sessions.length === 0 ? (
            <p className="empty-state">No login activity in this range.</p>
          ) : (
            <table className="admin-requests-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>User</th>
                  <th>Details</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className={eventClass(s.event_type)}>{eventLabel[s.event_type] ?? s.event_type}</span>
                    </td>
                    <td>{s.user_email ?? s.user_name ?? "-"}</td>
                    <td className="audit-details">{s.details ?? "-"}</td>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {!isLoading && !error && tab === "activity" && (
        <>
          {activity.length === 0 ? (
            <p className="empty-state">No data changes in this range.</p>
          ) : (
            <table className="admin-requests-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Entity</th>
                  <th>User</th>
                  <th>Details</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className={eventClass(a.event_type)}>{eventLabel[a.event_type] ?? a.event_type}</span>
                    </td>
                    <td>
                      {a.entity_type ? `${a.entity_type.replace("_", " ")}: ${a.entity_label ?? "-"}` : "-"}
                    </td>
                    <td>{a.user_email ?? a.user_name ?? "-"}</td>
                    <td className="audit-details">{a.details ?? "-"}</td>
                    <td>{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
};

export default AdminAuditLogPage;
