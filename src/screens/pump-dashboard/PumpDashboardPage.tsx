"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import "../dashboard/DashboardPage.css";
import "../report-detail/ReportDetailPage.css";
import "./PumpDashboardPage.css";
import { POINT_ROWS } from "@/components/report-detail/ReportDetailSections";
import { getPumpDashboard } from "@/services/testingService";
import type { PumpDashboardData, PumpTestReport } from "@/types/testing";

const fmt = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? "-" : v);

interface HeaderRowDef {
  label: string;
  field: keyof PumpTestReport;
}

const HEADER_ROWS: HeaderRowDef[] = [
  { label: "PO No.", field: "po_no" },
  { label: "EC No.", field: "ec_no" },
  { label: "Pump S.No.", field: "pump_serial_no" },
  { label: "Gearbox No.", field: "gearbox_no" },
  { label: "Gearbox Ratio", field: "gearbox_ratio" },
  { label: "Motor", field: "motor" },
  { label: "Motor RPM", field: "motor_rpm" },
  { label: "Capacity Method", field: "test_type" },
  { label: "NPSHa", field: "npsha_status" },
  { label: "Tested By", field: "tested_by" },
  { label: "Capacity Unit", field: "capacity_unit" },
  { label: "Head Unit", field: "head_unit" },
  { label: "Liquid", field: "liquid" },
  { label: "Rated Capacity", field: "rated_capacity" },
  { label: "Rated Head", field: "rated_head" },
  { label: "Rated RPM", field: "rated_rpm" },
  { label: "Specific Gravity", field: "specific_gravity" },
  { label: "Viscosity (CPS)", field: "viscosity_cps" },
  { label: "K for Given CPS", field: "k_for_given_cps" },
  { label: "Q Theoretical / 100 Rev", field: "q_theoretical_100rev" },
  { label: "Calculated Head", field: "calculated_head" },
  { label: "Suction", field: "suction_type" },
  { label: "Reference Voltage (Vin)", field: "reference_voltage" },
  { label: "Reference Current (Iin)", field: "reference_current" },
  { label: "V-Notch Baseline (Hin)", field: "vnotch_baseline" },
  { label: "Vibration — Sound (Db)", field: "vibration_sound_db" },
  { label: "Vibration — X (mm/sec)", field: "vibration_x_mm_sec" },
  { label: "Vibration — Y (mm/sec)", field: "vibration_y_mm_sec" },
  { label: "Vibration — Z (mm/sec)", field: "vibration_z_mm_sec" },
  { label: "Pump Started At", field: "pump_started_at" },
  { label: "Pump Stopped At", field: "pump_stopped_at" },
  { label: "Total Run", field: "total_run" },
  { label: "Ambient Temp (°C)", field: "ambient_temp_c" },
  { label: "Max. Bearing Temp (°C)", field: "max_bearing_temp_c" },
  { label: "Total Rise (°C)", field: "total_rise_c" },
  { label: "Witness", field: "witness" },
  { label: "Inspector", field: "inspector" },
  { label: "Recorder", field: "recorder" },
  { label: "Remarks", field: "remarks" },
];

const reportDate = (r: PumpTestReport) => r.test_date ?? r.created_at.slice(0, 10);

const PumpDashboardPage = () => {
  const { model } = useParams<{ model: string }>();
  const [data, setData] = useState<PumpDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    setIsLoading(true);
    setError("");

    getPumpDashboard(decodeURIComponent(model))
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this pump's dashboard.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [model]);

  if (isLoading) return <p className="dashboard-empty">Loading...</p>;
  if (error) return <div className="dashboard-error">{error}</div>;
  if (!data) return null;

  // Every report is a column (sorted chronologically) -- header/vibration
  // fields are one value per report, so each parameter's history over time
  // reads left to right, oldest to newest. No report identity (report_no,
  // links) is shown -- just the date each value came from.
  const sortedReports = [...data.reports].sort(
    (a, b) => reportDate(a).localeCompare(reportDate(b)) || a.created_at.localeCompare(b.created_at)
  );
  const activeHeaderRows = HEADER_ROWS.filter((row) =>
    sortedReports.some((r) => r[row.field] !== null && r[row.field] !== undefined && r[row.field] !== "")
  );

  // Every individual test point across every report is its own column, in
  // the same chronological order -- points recorded on the same date (same
  // report) simply repeat that date.
  const sortedPoints = sortedReports.flatMap((r) => r.points.map((p) => ({ report: r, point: p })));
  const activePointRows = POINT_ROWS.filter((row) =>
    sortedPoints.some(({ point }) => point[row.field] !== null && point[row.field] !== undefined)
  );

  const hasObservation = data.reports.some((r) => (r.report_format ?? "observation") === "observation");
  const hasViscosityChart = data.reports.some((r) => r.report_format === "viscosity-chart");
  const latestTestDate = sortedReports.length ? reportDate(sortedReports[sortedReports.length - 1]) : "-";

  return (
    <div className="pump-dashboard-page">
      <div className="pump-dashboard-header sticky-page-header">
        <h1>{data.model}</h1>
        <Link href="/pumps" className="back-link">
          &larr; Back to pump dashboard
        </Link>
      </div>

      <div className="pump-summary-stats">
        <div className="pump-summary-stat">
          <span className="stat-value">{data.requisitions.length}</span>
          <span className="stat-label">Requisitions</span>
        </div>
        <div className="pump-summary-stat">
          <span className="stat-value">{data.reports.length}</span>
          <span className="stat-label">Test Reports</span>
        </div>
        <div className="pump-summary-stat">
          <span className="stat-value">{hasObservation ? "Yes" : "No"}</span>
          <span className="stat-label">Observation Sheet</span>
        </div>
        <div className="pump-summary-stat">
          <span className="stat-value">{hasViscosityChart ? "Yes" : "No"}</span>
          <span className="stat-label">Viscosity Chart</span>
        </div>
        <div className="pump-summary-stat">
          <span className="stat-value">{latestTestDate}</span>
          <span className="stat-label">Latest Test Date</span>
        </div>
      </div>

      <section className="dashboard-section">
        <h2>Requisitions ({data.requisitions.length})</h2>
        {data.requisitions.length === 0 ? (
          <p className="dashboard-empty">No requisitions raised for this pump.</p>
        ) : (
          <table className="requisition-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>EC/Quotation No.</th>
                <th>RES.</th>
                <th>Source Team</th>
                <th>Date of Receipt</th>
                <th>Submitted By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.requisitions.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/requisitions/${r.id}`}>{r.category ?? "-"}</Link>
                  </td>
                  <td>{r.ec_quotation_no ?? "-"}</td>
                  <td>{r.responsible_person ?? "-"}</td>
                  <td>{r.source_team ?? "-"}</td>
                  <td>{r.date_of_receipt ?? "-"}</td>
                  <td>{r.submitted_by ?? "-"}</td>
                  <td>
                    <span className={`status-pill status-${r.status.replace(/\s+/g, "-").toLowerCase()}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="report-detail-page">
        <section className="detail-card">
          <h2>Header Parameters Over Time</h2>
          {sortedReports.length === 0 ? (
            <p className="dashboard-empty">No test reports for this pump.</p>
          ) : (
            <table className="sheet-table header-history-table">
              <thead>
                <tr>
                  <th className="row-label-col">Parameter</th>
                  {sortedReports.map((r) => (
                    <th key={r.id}>{reportDate(r)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeHeaderRows.map((row) => (
                  <tr key={row.label}>
                    <td className="row-label-col">{row.label}</td>
                    {sortedReports.map((r) => (
                      <td key={r.id} className="highlight">
                        {fmt(r[row.field] as string | number | null)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="detail-card">
          <h2>Test Point Parameters Over Time ({sortedPoints.length} points)</h2>
          {sortedPoints.length === 0 ? (
            <p className="dashboard-empty">No test points recorded for this pump.</p>
          ) : (
            <div className="sheet-table-wrapper">
              <table className="sheet-table points-sheet-table">
                <thead>
                  <tr>
                    <th className="row-label-col">Parameter</th>
                    <th className="row-unit-col">Unit</th>
                    {sortedPoints.map(({ report, point }, i) => (
                      <th key={point.id ?? i}>{reportDate(report)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activePointRows.map((row) => (
                    <tr key={`${row.label}-${row.unit ?? ""}`}>
                      <td className="row-label-col">{row.label}</td>
                      <td className="row-unit-col">{row.unit ?? ""}</td>
                      {sortedPoints.map(({ point }, i) => (
                        <td key={point.id ?? i} className="highlight">
                          {fmt(point[row.field])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PumpDashboardPage;
