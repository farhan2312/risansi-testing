"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import "./AdminAccessRequestsPage.css";
import "./AdminBugReportsPage.css"; // reuses .bug-status-tab pill styling
import "./AdminAuditLogPage.css";
import {
  getAuditActivity,
  getAuditSessions,
  getAuditSummary,
  getAuditUsage,
  getAuditUserPages,
} from "@/services/adminService";
import type {
  AuditActivityEntry,
  AuditRange,
  AuditSessionEntry,
  AuditSummary,
  AuditUsageRow,
  AuditUserPageRow,
} from "@/types/testing";

type Tab = "usage" | "sessions" | "activity";
type ActionFilter = "all" | "create" | "update" | "delete";

const RANGE_TABS: { label: string; value: AuditRange }[] = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7days" },
  { label: "30 days", value: "30days" },
  { label: "All", value: "all" },
];

const ACTION_FILTERS: { label: string; value: ActionFilter }[] = [
  { label: "All actions", value: "all" },
  { label: "Created", value: "create" },
  { label: "Updated", value: "update" },
  { label: "Deleted", value: "delete" },
];

const ROLE_LABELS: Record<string, string> = {
  source: "SOURCE",
  testing: "TESTING",
  "central-admin": "C.ADMIN",
  admin: "ADMIN",
};

const roleClass = (role: string | null) => (role ? `audit-role-badge audit-role-${role.replace(/[^a-z]/g, "")}` : "");

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

/** Only requisitions and reports have their own detail page to link to --
 * everything else (attachments, users, bug reports) just shows as text.
 * Links with the pretty number when it resolved (entity_no), falls back to
 * the raw uuid otherwise (e.g. the row's since been deleted, so entity_no
 * came back null -- the link still resolves via requisitionLookup's
 * backward-compat uuid match, it just won't be pretty). */
const entityHref = (entityType: string | null, entityId: string | null, entityNo: string | null): string | null => {
  if (!entityId) return null;
  if (entityType === "requisition") return `/requisitions/${entityNo ?? entityId}`;
  if (entityType === "report") return `/reports/${entityNo ?? entityId}`;
  return null;
};

const AdminAuditLogPage = () => {
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [tab, setTab] = useState<Tab>("usage");
  const [range, setRange] = useState<AuditRange>("7days");
  const [usage, setUsage] = useState<AuditUsageRow[]>([]);
  const [sessions, setSessions] = useState<AuditSessionEntry[]>([]);
  const [activity, setActivity] = useState<AuditActivityEntry[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Activity tab search/filter -- searchInput is the live textbox value,
  // appliedSearch is what was actually last submitted (Search button or
  // Enter), matching the reference's explicit-search UX rather than
  // refetching on every keystroke.
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");

  // Usage & Time drill-down -- which user row is expanded, and that user's
  // per-page breakdown once loaded (keyed by user_id so switching users
  // doesn't require a fresh click-to-reload if you go back to one already seen).
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userPages, setUserPages] = useState<Record<string, AuditUserPageRow[]>>({});
  const [pagesLoading, setPagesLoading] = useState(false);

  useEffect(() => {
    getAuditSummary()
      .then(setSummary)
      .catch(() => setError("Could not load the summary."));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError("");
    setExpandedUser(null);
    const loader =
      tab === "usage"
        ? getAuditUsage(range).then(setUsage)
        : tab === "sessions"
        ? getAuditSessions(range).then(setSessions)
        : getAuditActivity(range, {
            search: appliedSearch || undefined,
            action: actionFilter === "all" ? undefined : actionFilter,
          }).then((r) => {
            setActivity(r.entries);
            setActivityTotal(r.total);
          });
    loader.catch(() => setError("Could not load this tab.")).finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, range, appliedSearch, actionFilter]);

  const totalActiveTime = usage.reduce((sum, r) => sum + r.active_seconds, 0);

  const toggleUserRow = (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    if (!userPages[userId]) {
      setPagesLoading(true);
      getAuditUserPages(userId, range)
        .then((rows) => setUserPages((prev) => ({ ...prev, [userId]: rows })))
        .catch(() => setUserPages((prev) => ({ ...prev, [userId]: [] })))
        .finally(() => setPagesLoading(false));
    }
  };

  const runSearch = () => setAppliedSearch(searchInput.trim());

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
            {usage.length} users active · {formatDuration(totalActiveTime)} total active time · click a user for the page breakdown
          </p>
          {usage.length === 0 ? (
            <p className="empty-state">No activity in this range.</p>
          ) : (
            <table className="admin-requests-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Active Time</th>
                  <th>Sessions</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((r) => (
                  <Fragment key={r.user_id}>
                    <tr className="audit-user-row" onClick={() => toggleUserRow(r.user_id)}>
                      <td>
                        <span className="audit-expand-toggle">{expandedUser === r.user_id ? "−" : "+"}</span>
                        {r.user_email ?? r.user_name ?? "-"}
                      </td>
                      <td>{r.user_role && <span className={roleClass(r.user_role)}>{ROLE_LABELS[r.user_role] ?? r.user_role}</span>}</td>
                      <td>
                        <strong>{formatDuration(r.active_seconds)}</strong>
                      </td>
                      <td>{r.session_count}</td>
                      <td>{new Date(r.last_active).toLocaleString()}</td>
                    </tr>
                    {expandedUser === r.user_id && (
                      <tr className="audit-user-detail-row">
                        <td colSpan={5}>
                          {pagesLoading && !userPages[r.user_id] ? (
                            <p className="audit-tab-subline">Loading page breakdown...</p>
                          ) : (userPages[r.user_id]?.length ?? 0) === 0 ? (
                            <p className="empty-state">No individual page views recorded in this range.</p>
                          ) : (
                            <table className="audit-page-breakdown-table">
                              <thead>
                                <tr>
                                  <th>Page</th>
                                  <th>Views</th>
                                  <th>Last Visited</th>
                                </tr>
                              </thead>
                              <tbody>
                                {userPages[r.user_id]!.map((p) => (
                                  <tr key={p.path}>
                                    <td>{p.path}</td>
                                    <td>{p.view_count}</td>
                                    <td>{new Date(p.last_viewed).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
          <div className="audit-activity-toolbar">
            <input
              type="text"
              placeholder="Search user, entity, action..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value as ActionFilter)}>
              {ACTION_FILTERS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn-primary" onClick={runSearch}>
              Search
            </button>
          </div>
          <p className="audit-tab-subline">
            {activityTotal.toLocaleString()} entries · newest first
            {activity.length < activityTotal ? ` (showing latest ${activity.length})` : ""}
          </p>

          {activity.length === 0 ? (
            <p className="empty-state">No data changes match this filter.</p>
          ) : (
            <table className="admin-requests-table audit-activity-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>What</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => {
                  const href = entityHref(a.entity_type, a.entity_id, a.entity_no);
                  const typeLabel = a.entity_type
                    ? a.entity_type.replace("_", " ").replace(/^./, (c) => c.toUpperCase())
                    : null;
                  const entityText = typeLabel ? `${typeLabel}${a.entity_label ? ` · ${a.entity_label}` : ""}` : "-";
                  return (
                    <tr key={a.id}>
                      <td className="audit-when">{new Date(a.created_at).toLocaleString()}</td>
                      <td>
                        {a.user_email ?? a.user_name ?? "-"}
                        {a.user_role && <span className={roleClass(a.user_role)}>{ROLE_LABELS[a.user_role] ?? a.user_role}</span>}
                      </td>
                      <td>
                        <span className={eventClass(a.event_type)}>{eventLabel[a.event_type] ?? a.event_type}</span>
                      </td>
                      <td>
                        {href ? (
                          <Link href={href} className="audit-entity-link">
                            {entityText}
                          </Link>
                        ) : (
                          entityText
                        )}
                      </td>
                      <td className="audit-details">{a.details ?? "-"}</td>
                      <td className="audit-ip">{a.ip_address ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
};

export default AdminAuditLogPage;
