"use client";

import Link from "next/link";
import { computeRequirementStatus, unmetRequirementLabels } from "@/lib/requirementCheck";
import type { PumpTestReport, PumpTestReportPoint } from "@/types/testing";

const fmt = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? "-" : v);

export interface PointRowDef {
  label: string;
  unit?: string;
  field: keyof PumpTestReportPoint;
}

export const POINT_ROWS: PointRowDef[] = [
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

/**
 * Every parameter for one report -- Given Data, Test Data, Vibration & Run
 * Summary, Witness/Remarks. Shared between ReportDetailPage (single report)
 * and the per-pump dashboard (every report for that pump, stacked).
 */
const ReportDetailSections = ({ report }: { report: PumpTestReport }) => {
  const points = [...report.points].sort(
    (a, b) => (a.head_kgcm2 ?? 0) - (b.head_kgcm2 ?? 0) || (a.rpm ?? 0) - (b.rpm ?? 0)
  );
  const activeRows = POINT_ROWS.filter((row) =>
    points.some((p) => p[row.field] !== null && p[row.field] !== undefined)
  );

  const hasVibrationSummary = [
    report.vibration_sound_db, report.vibration_x_mm_sec, report.vibration_y_mm_sec,
    report.vibration_z_mm_sec, report.pump_started_at, report.pump_stopped_at, report.total_run,
    report.ambient_temp_c, report.max_bearing_temp_c, report.total_rise_c,
  ].some((v) => v !== null && v !== undefined && v !== "");

  // Did testing actually reach the rated requirements? Still a valid report
  // either way -- this is a flag, not a validation error.
  const requirementStatus = computeRequirementStatus(report, report.points);
  const unmetLabels = unmetRequirementLabels(requirementStatus);

  return (
    <>
      {unmetLabels.length > 0 && (
        <div className="requirement-not-met-banner">
          ⚠ This report did not meet the rated requirement for: {unmetLabels.join(", ")}.
        </div>
      )}

      <section className="detail-card">
        <h2>Given Data</h2>
        <div className="sheet-table-wrapper">
        <table className="sheet-table header-sheet-table">
          <tbody>
            <tr>
              <th>PO No.</th>
              <td>{fmt(report.po_no)}</td>
              <th>EC No.</th>
              <td>{fmt(report.ec_no)}</td>
              <th>Pump S.No.</th>
              <td>{fmt(report.pump_serial_no)}</td>
            </tr>
            <tr>
              <th>Gear Box No.</th>
              <td>{fmt(report.gearbox_no)}</td>
              <th>Gearbox Ratio</th>
              <td>{fmt(report.gearbox_ratio)}</td>
              <th></th>
              <td></td>
            </tr>
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
              <td className={`highlight ${requirementStatus.capacity === false ? "requirement-cell-not-met" : ""}`}>
                {fmt(report.rated_capacity)}
              </td>
              <th>Rated Head</th>
              <td className={`highlight ${requirementStatus.head === false ? "requirement-cell-not-met" : ""}`}>
                {fmt(report.rated_head)}
              </td>
              <th>Rated RPM</th>
              <td className="highlight">{fmt(report.rated_rpm)}</td>
            </tr>
            <tr>
              <th>Rated Power (KW)</th>
              <td className={`highlight ${requirementStatus.power === false ? "requirement-cell-not-met" : ""}`}>
                {fmt(report.rated_power_kw)}
              </td>
              <th></th>
              <td></td>
              <th></th>
              <td></td>
            </tr>
            <tr>
              <th>Specific Gravity</th>
              <td className="highlight">{fmt(report.specific_gravity)}</td>
              <th>Viscosity (CPS)</th>
              <td className="highlight">{fmt(report.viscosity_cps)}</td>
              <th>K for Given CPS</th>
              <td className="highlight">{fmt(report.k_for_given_cps)}</td>
            </tr>
            <tr>
              <th>Q Theoretical / 100 Rev</th>
              <td className="highlight">{fmt(report.q_theoretical_100rev)}</td>
              <th>Calculated Head</th>
              <td className="highlight">{fmt(report.calculated_head)}</td>
              <th>Suction</th>
              <td>{fmt(report.suction_type)}</td>
            </tr>
            <tr>
              <th>Reference Voltage (Vin)</th>
              <td className="highlight">{fmt(report.reference_voltage)}</td>
              <th>Reference Current (Iin)</th>
              <td className="highlight">{fmt(report.reference_current)}</td>
              <th>V-Notch Baseline (Hin)</th>
              <td className="highlight">{fmt(report.vnotch_baseline)}</td>
            </tr>
            <tr>
              <th>Linked Testing Summary</th>
              <td colSpan={5}>
                {report.requisition_id ? (
                  <Link href={`/requisitions/${report.requisition_id}`}>
                    {report.requisition_id.slice(0, 8)}
                  </Link>
                ) : (
                  "Historical (imported)"
                )}
              </td>
            </tr>
            {report.prepared_by && (
              <tr>
                <th>Prepared By</th>
                <td colSpan={5}>{report.prepared_by}</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
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
              {activeRows.map((row) => {
                const rowNotMet =
                  (row.field === "head_kgcm2" && requirementStatus.head === false) ||
                  (row.field === "capacity_calculated_m3hr" && requirementStatus.capacity === false) ||
                  (row.field === "power_calculated_kw" && requirementStatus.power === false);
                return (
                  <tr key={`${row.label}-${row.unit ?? ""}`}>
                    <td className="row-label-col">
                      {row.label}
                      {rowNotMet && (
                        <span className="requirement-flag" title="Testing did not reach this rated value">
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className="row-unit-col">{row.unit ?? ""}</td>
                    {points.map((p, i) => (
                      <td key={p.id ?? i} className={rowNotMet ? "requirement-cell-not-met" : "highlight"}>
                        {fmt(p[row.field])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {hasVibrationSummary && (
        <section className="detail-card">
          <h2>Vibration Test &amp; Run Summary</h2>
          <div className="sheet-table-wrapper">
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
            </tbody>
          </table>
          </div>
        </section>
      )}

      <section className="detail-card">
        <h2>Witness, Inspection &amp; Remarks</h2>
        <div className="sheet-table-wrapper">
        <table className="sheet-table header-sheet-table sign-off-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Name</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Witness</th>
              <td>{fmt(report.witness)}</td>
              <td className="signature-line"></td>
            </tr>
            <tr>
              <th>Inspector</th>
              <td>{fmt(report.inspector)}</td>
              <td className="signature-line"></td>
            </tr>
            <tr>
              <th>Recorder</th>
              <td>{fmt(report.recorder)}</td>
              <td className="signature-line"></td>
            </tr>
          </tbody>
        </table>
        </div>
        <div className={report.remarks ? "remarks-box" : "remarks-box remarks-box-blank"}>
          {report.remarks ? (
            <p className="remarks-text">{report.remarks}</p>
          ) : (
            <span className="remarks-placeholder">Remarks</span>
          )}
        </div>
      </section>
    </>
  );
};

export default ReportDetailSections;
