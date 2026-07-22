"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./DashboardPage.css";
import { listRequisitions } from "@/services/testingService";
import { getCurrentUser } from "@/services/session";
import type { RequisitionStatus, TestRequisition } from "@/types/testing";

const STATUS_TABS: { label: string; value: RequisitionStatus | "All" }[] = [
  { label: "All", value: "All" },
  { label: "Pending", value: "Pending" },
  { label: "In Testing", value: "In Testing" },
  { label: "Retest Needed", value: "Retest Needed" },
  { label: "Closed", value: "Closed" },
];

const DashboardPage = () => {
  const [requisitions, setRequisitions] = useState<TestRequisition[]>([]);
  const [activeStatus, setActiveStatus] = useState<RequisitionStatus | "All">("All");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const canCreateRequisition = getCurrentUser()?.role !== "testing";

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    listRequisitions(activeStatus === "All" ? undefined : activeStatus)
      .then((rows) => {
        if (!cancelled) setRequisitions(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load requisitions.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeStatus]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Testing Requisitions</h1>
        {canCreateRequisition && (
          <Link href="/requisitions/new" className="new-requisition-btn">
            + New Requisition
          </Link>
        )}
      </div>

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

      {error && <div className="dashboard-error">{error}</div>}

      {isLoading ? (
        <p className="dashboard-empty">Loading...</p>
      ) : requisitions.length === 0 ? (
        <p className="dashboard-empty">No requisitions in this status.</p>
      ) : (
        <table className="requisition-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Category</th>
              <th>EC/Quotation No.</th>
              <th>RES.</th>
              <th>Source Team</th>
              <th>Date of Receipt</th>
              <th>Retest Needed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {requisitions.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/requisitions/${r.id}`}>{r.model}</Link>
                </td>
                <td>{r.category ?? "-"}</td>
                <td>{r.ec_quotation_no ?? "-"}</td>
                <td>{r.responsible_person ?? "-"}</td>
                <td>{r.source_team ?? "-"}</td>
                <td>{r.date_of_receipt ?? "-"}</td>
                <td>{r.retest_needed === null ? "-" : r.retest_needed ? "Yes" : "No"}</td>
                <td>
                  {r.status === "Closed" && r.report_id ? (
                    <Link href={`/reports/${r.report_id}`} className="status-pill status-view-report">
                      View Report
                    </Link>
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
    </div>
  );
};

export default DashboardPage;
