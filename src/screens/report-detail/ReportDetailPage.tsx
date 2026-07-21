"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import "./ReportDetailPage.css";
import { getReport } from "@/services/testingService";
import type { PumpTestReport, PumpTestReportPoint } from "@/types/testing";

const fmt = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? "-" : v);

interface PointRowDef {
  label: string;
  unit?: string;
  field: keyof PumpTestReportPoint;
}

const POINT_ROWS: PointRowDef[] = [
  { label: "Measured Data at RPM", unit: "RPM", field: "rpm" },
  { label: "Measured Data at Head", unit: "kg/cm2", field: "head_kgcm2" },
  { label: "Measured Data at Head", unit: "MWC", field: "head_mwc" },
  { label: "Height Taken for Filling", unit: "mm", field: "height_taken_for_filling" },
  { label: "Height Over V-Notch", unit: "mm", field: "vnotch_height" },
  { label: "Time to Fill 5L Bucket", unit: "sec", field: "time_taken_to_fill_bucket_sec" },
  { label: "Initial Reading", unit: "mm", field: "initial_reading" },
  { label: "Differential Height", unit: "mm", field: "differential_height" },
  { label: "Capacity Calculated", unit: "M3/Hr", field: "capacity_calculated_m3hr" },
  { label: "Volts Measured", unit: "V", field: "volts" },
  { label: "Amperes Measured", unit: "A", field: "amps" },
  { label: "Cos Phi", field: "cos_phi" },
  { label: "Power Calculated", unit: "Kw", field: "power_calculated_kw" },
  { label: "Theoretical Power Calculated", unit: "Kw", field: "theoretical_power_kw" },
  { label: "Volumetric Efficiency (VE)", unit: "%", field: "volumetric_efficiency" },
  { label: "Mechanical Efficiency (ME)", unit: "%", field: "mechanical_efficiency" },
  { label: "Theoretical Capacity at Measured RPM", unit: "M3/Hr", field: "theoretical_capacity_at_measured_rpm" },
  { label: "Slip of Water", unit: "M3/Hr", field: "slip_water" },
  { label: "Slip for Viscous Fluid", unit: "M3/Hr", field: "slip_viscous" },
  { label: "Theoretical Capacity at Rated RPM", unit: "M3/Hr", field: "theoretical_capacity_at_rated_rpm" },
  { label: "Capacity for Liquid at Rated RPM", unit: "M3/Hr", field: "capacity_liquid_at_rated_rpm_m3hr" },
  { label: "Capacity for Liquid at Rated RPM", unit: "LPH", field: "capacity_liquid_at_rated_rpm_lph" },
  { label: "Volumetric Efficiency for Liquid", unit: "%", field: "volumetric_efficiency_liquid" },
  { label: "Mechanical Efficiency for Liquid", unit: "%", field: "mechanical_efficiency_liquid" },
];

const FORMAT_LABELS: Record<string, string> = {
  observation: "Observation Sheet",
  "viscosity-chart": "Viscosity Correction Chart",
};

const ReportDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<PumpTestReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getReport(id).then(setReport).catch(() => setError("Could not load report."));
  }, [id]);

  if (error) return <div className="form-error-banner">{error}</div>;
  if (!report) return <p className="detail-empty">Loading...</p>;

  const points = [...report.points].sort(
    (a, b) => (a.rpm ?? 0) - (b.rpm ?? 0) || (a.head_kgcm2 ?? 0) - (b.head_kgcm2 ?? 0)
  );
  const activeRows = POINT_ROWS.filter((row) =>
    points.some((p) => p[row.field] !== null && p[row.field] !== undefined)
  );

  const isObservationSheet = (report.report_format ?? "observation") === "observation";
  const hasVibrationSummary = [
    report.vibration_sound_db, report.vibration_x_mm_sec, report.vibration_y_mm_sec,
    report.vibration_z_mm_sec, report.pump_started_at, report.pump_stopped_at, report.total_run,
    report.ambient_temp_c, report.max_bearing_temp_c, report.total_rise_c,
    report.witness, report.inspector, report.recorder,
  ].some((v) => v !== null && v !== undefined && v !== "");

  return (
    <div className="report-detail-page">
      <div className="detail-header">
        <div>
          <h1>{report.model}</h1>
          <span className="format-pill">
            {FORMAT_LABELS[report.report_format ?? ""] ?? "Observation Sheet"}
          </span>
        </div>
        <Link href="/reports" className="back-link">
          &larr; Back to archive
        </Link>
      </div>

      <section className="detail-card">
        <h2>Given Data</h2>
        <table className="sheet-table header-sheet-table">
          <tbody>
            {report.report_format === "viscosity-chart" ? (
              <tr>
                <th>PO No.</th>
                <td>{fmt(report.po_no)}</td>
                <th>EC No.</th>
                <td>{fmt(report.ec_no)}</td>
                <th>Rev No. / Date</th>
                <td>
                  {fmt(report.rev_no)} / {fmt(report.rev_date)}
                </td>
              </tr>
            ) : (
              <tr>
                <th>Gear Box No.</th>
                <td>{fmt(report.gearbox_no)}</td>
                <th>Ratio</th>
                <td>{fmt(report.gearbox_ratio)}</td>
                <th>Suction</th>
                <td>{fmt(report.suction_type)}</td>
              </tr>
            )}
            {report.report_format === "viscosity-chart" && (
              <tr>
                <th>Pump S.No.</th>
                <td colSpan={5}>{fmt(report.pump_serial_no)}</td>
              </tr>
            )}
            <tr>
              <th>Motor</th>
              <td>{fmt(report.motor)}</td>
              <th>Motor RPM</th>
              <td>{fmt(report.motor_rpm)}</td>
              <th>Test Date</th>
              <td>{report.test_date ?? report.created_at.slice(0, 10)}</td>
            </tr>
            <tr>
              <th>Capacity Method</th>
              <td className="highlight">{fmt(report.test_type)}</td>
              <th>NPSHa</th>
              <td className="highlight">{fmt(report.npsha_status)}</td>
              <th>Tested By</th>
              <td>{fmt(report.tested_by)}</td>
            </tr>
            <tr>
              <th>Capacity Unit</th>
              <td className="highlight">{fmt(report.capacity_unit)}</td>
              <th>Head Unit</th>
              <td className="highlight">{fmt(report.head_unit)}</td>
              <th>Liquid</th>
              <td className="highlight">{fmt(report.liquid)}</td>
            </tr>
            <tr>
              <th>Rated Capacity</th>
              <td className="highlight">{fmt(report.rated_capacity)}</td>
              <th>Rated Head</th>
              <td className="highlight">{fmt(report.rated_head)}</td>
              <th>Rated RPM</th>
              <td className="highlight">{fmt(report.rated_rpm)}</td>
            </tr>
            <tr>
              <th>Specific Gravity</th>
              <td className="highlight">{fmt(report.specific_gravity)}</td>
              <th>Viscosity (CPS)</th>
              <td className="highlight">{fmt(report.viscosity_cps)}</td>
              <th>K for Given CPS</th>
              <td className="highlight">{fmt(report.k_for_given_cps)}</td>
            </tr>
            {report.report_format === "viscosity-chart" ? (
              <tr>
                <th>Q Theoretical / 100 Rev</th>
                <td className="highlight">{fmt(report.q_theoretical_100rev)}</td>
                <th>Calculated Head</th>
                <td className="highlight" colSpan={3}>{fmt(report.calculated_head)}</td>
              </tr>
            ) : (
              <tr>
                <th>Q Theoretical / 100 Rev</th>
                <td className="highlight">{fmt(report.q_theoretical_100rev)}</td>
                <th>Reference Voltage (Vin)</th>
                <td className="highlight">{fmt(report.reference_voltage)}</td>
                <th>Reference Current (Iin)</th>
                <td className="highlight">{fmt(report.reference_current)}</td>
              </tr>
            )}
            <tr>
              {report.report_format !== "viscosity-chart" && (
                <>
                  <th>V-Notch Baseline (Hin)</th>
                  <td className="highlight">{fmt(report.vnotch_baseline)}</td>
                </>
              )}
              <th>Linked Requisition</th>
              <td colSpan={report.report_format === "viscosity-chart" ? 5 : 3}>
                {report.requisition_id ? (
                  <Link href={`/requisitions/${report.requisition_id}`}>
                    {report.requisition_id.slice(0, 8)}
                  </Link>
                ) : (
                  "Historical (imported)"
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="detail-card">
        <h2>Test Data ({points.length} points)</h2>
        <div className="sheet-table-wrapper">
          <table className="sheet-table points-sheet-table">
            <thead>
              <tr>
                <th className="row-label-col">Parameter</th>
                <th className="row-unit-col">Unit</th>
                {points.map((p, i) => (
                  <th key={p.id ?? i}>Pt. {i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row) => (
                <tr key={`${row.label}-${row.unit ?? ""}`}>
                  <td className="row-label-col">{row.label}</td>
                  <td className="row-unit-col">{row.unit ?? ""}</td>
                  {points.map((p, i) => (
                    <td key={p.id ?? i} className="highlight">
                      {fmt(p[row.field])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isObservationSheet && hasVibrationSummary && (
        <section className="detail-card">
          <h2>Vibration Test &amp; Run Summary</h2>
          <table className="sheet-table header-sheet-table">
            <tbody>
              <tr>
                <th>Vibration — Sound</th>
                <td>{fmt(report.vibration_sound_db)} Db</td>
                <th>X</th>
                <td>{fmt(report.vibration_x_mm_sec)} mm/sec</td>
              </tr>
              <tr>
                <th>Y</th>
                <td>{fmt(report.vibration_y_mm_sec)} mm/sec</td>
                <th>Z</th>
                <td>{fmt(report.vibration_z_mm_sec)} mm/sec</td>
              </tr>
              <tr>
                <th>Pump Started At</th>
                <td>{fmt(report.pump_started_at)}</td>
                <th>Pump Stopped At</th>
                <td>{fmt(report.pump_stopped_at)}</td>
              </tr>
              <tr>
                <th>Total Run</th>
                <td>{fmt(report.total_run)}</td>
                <th>Ambient Temp</th>
                <td>{fmt(report.ambient_temp_c)} °C</td>
              </tr>
              <tr>
                <th>Max. Bearing Temp</th>
                <td>{fmt(report.max_bearing_temp_c)} °C</td>
                <th>Total Rise</th>
                <td>{fmt(report.total_rise_c)} °C</td>
              </tr>
              <tr>
                <th>Witness</th>
                <td>{fmt(report.witness)}</td>
                <th>Inspector</th>
                <td>{fmt(report.inspector)}</td>
              </tr>
              <tr>
                <th>Recorder</th>
                <td colSpan={3}>{fmt(report.recorder)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {report.remarks && (
        <section className="detail-card">
          <h2>Remarks</h2>
          <p className="remarks-text">{report.remarks}</p>
        </section>
      )}
    </div>
  );
};

export default ReportDetailPage;
