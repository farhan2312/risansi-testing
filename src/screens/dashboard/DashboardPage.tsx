"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./DashboardPage.css";
import { listRequisitions, updateRequisition } from "@/services/testingService";
import { getCurrentUser } from "@/services/session";
import {
  REQUISITION_CATEGORIES,
  RESPONSIBLE_PERSONS,
  SOURCE_TEAMS,
  type RequisitionStatus,
  type TestRequisition,
} from "@/types/testing";

const ALL = "All";

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
  const canReassign = getCurrentUser()?.role === "testing";

  const [modelFilter, setModelFilter] = useState(ALL);
  const [ecFilter, setEcFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [sourceTeamFilter, setSourceTeamFilter] = useState(ALL);
  const [responsiblePersonFilter, setResponsiblePersonFilter] = useState(ALL);

  const modelOptions = useMemo(
    () => [...new Set(requisitions.map((r) => r.model))].sort((a, b) => a.localeCompare(b)),
    [requisitions]
  );

  const hasActiveFilters =
    modelFilter !== ALL ||
    ecFilter.trim() !== "" ||
    categoryFilter !== ALL ||
    sourceTeamFilter !== ALL ||
    responsiblePersonFilter !== ALL;

  const clearFilters = () => {
    setModelFilter(ALL);
    setEcFilter("");
    setCategoryFilter(ALL);
    setSourceTeamFilter(ALL);
    setResponsiblePersonFilter(ALL);
  };

  const filteredRequisitions = useMemo(() => {
    const ec = ecFilter.trim().toLowerCase();
    return requisitions.filter((r) => {
      if (modelFilter !== ALL && r.model !== modelFilter) return false;
      if (ec && !(r.ec_quotation_no ?? "").toLowerCase().includes(ec)) return false;
      if (categoryFilter !== ALL && r.category !== categoryFilter) return false;
      if (sourceTeamFilter !== ALL && r.source_team !== sourceTeamFilter) return false;
      if (responsiblePersonFilter !== ALL && r.responsible_person !== responsiblePersonFilter) return false;
      return true;
    });
  }, [requisitions, modelFilter, ecFilter, categoryFilter, sourceTeamFilter, responsiblePersonFilter]);

  const handleReassign = async (id: string, responsiblePerson: string) => {
    try {
      const updated = await updateRequisition(id, { responsible_person: responsiblePerson });
      setRequisitions((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      setError("Could not update responsible person. Please try again.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    listRequisitions(activeStatus === "All" ? undefined : activeStatus)
      .then((rows) => {
        if (!cancelled) setRequisitions(rows);
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
  }, [activeStatus]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Testing Summary</h1>
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
          value={ecFilter}
          onChange={(e) => setEcFilter(e.target.value)}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value={ALL}>All Categories</option>
          {REQUISITION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
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
        {hasActiveFilters && (
          <button type="button" className="clear-filters-btn" onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      {isLoading ? (
        <p className="dashboard-empty">Loading...</p>
      ) : filteredRequisitions.length === 0 ? (
        <p className="dashboard-empty">
          {requisitions.length === 0 ? "No testing summaries in this status." : "No testing summaries match these filters."}
        </p>
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
              <th>Submitted By</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequisitions.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/requisitions/${r.id}`}>{r.model}</Link>
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
                <td>{r.date_of_receipt ?? "-"}</td>
                <td>{r.retest_needed === null ? "-" : r.retest_needed ? "Yes" : "No"}</td>
                <td>{r.submitted_by ?? "-"}</td>
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
