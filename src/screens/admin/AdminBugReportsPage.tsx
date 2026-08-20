"use client";

import { useEffect, useState } from "react";
import "./AdminAccessRequestsPage.css";
import "./AdminBugReportsPage.css";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  deleteBugReport,
  listBugReports,
  openBugReportScreenshot,
  setBugReportStatus,
} from "@/services/adminService";
import type { BugReport, BugReportStatus } from "@/types/testing";

const STATUS_TABS: (BugReportStatus | "All")[] = ["All", "Open", "In Progress", "Resolved"];
const STATUSES: BugReportStatus[] = ["Open", "In Progress", "Resolved"];

const severityClass = (severity: string) => `bug-severity bug-severity-${severity.toLowerCase()}`;

const AdminBugReportsPage = () => {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [activeTab, setActiveTab] = useState<BugReportStatus | "All">("All");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BugReport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = () => {
    setIsLoading(true);
    setError("");
    listBugReports()
      .then(setReports)
      .catch(() => setError("Could not load bug reports."))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const handleStatusChange = async (report: BugReport, status: BugReportStatus) => {
    setUpdatingId(report.id);
    try {
      const updated = await setBugReportStatus(report.id, status);
      setReports((prev) => prev.map((r) => (r.id === report.id ? updated : r)));
    } catch {
      setError("Could not update status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteBugReport(pendingDelete.id);
      setReports((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch {
      setError("Could not delete this report. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = activeTab === "All" ? reports : reports.filter((r) => r.status === activeTab);

  return (
    <div className="admin-requests-page">
      <div className="admin-requests-header sticky-page-header">
        <h1>Bug Reports</h1>
        <p>Issues and feature requests submitted from the "Report a Bug" widget.</p>
      </div>

      <div className="bug-status-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "bug-status-tab active" : "bug-status-tab"}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab !== "All" && (
              <span className="bug-status-tab-count">{reports.filter((r) => r.status === tab).length}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading && <p>Loading...</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && filtered.length === 0 && <p className="empty-state">Nothing here.</p>}

      {!isLoading && !error && filtered.length > 0 && (
        <table className="admin-requests-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>Severity</th>
              <th>Page</th>
              <th>Reported By</th>
              <th>Date</th>
              <th>Status</th>
              <th>Screenshot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={r.type === "bug" ? "bug-type-badge bug-type-badge-bug" : "bug-type-badge bug-type-badge-feature"}>
                    {r.type === "bug" ? "Bug" : "Feature"}
                  </span>
                </td>
                <td>
                  <strong>{r.title}</strong>
                  {r.description && <div className="bug-description">{r.description}</div>}
                </td>
                <td>
                  <span className={severityClass(r.severity)}>{r.severity}</span>
                </td>
                <td>{r.page ?? "-"}</td>
                <td>{r.reported_by_name ?? "-"}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>
                  <select
                    className="role-select"
                    value={r.status}
                    disabled={updatingId === r.id}
                    onChange={(e) => handleStatusChange(r, e.target.value as BugReportStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {r.has_screenshot ? (
                    <button type="button" className="bug-link-btn" onClick={() => openBugReportScreenshot(r.id)}>
                      View
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <button type="button" className="reject-btn" onClick={() => setPendingDelete(r)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete bug report?"
          message={`This permanently deletes "${pendingDelete.title}". This can't be undone.`}
          confirmLabel="Delete"
          danger
          isConfirming={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

export default AdminBugReportsPage;
