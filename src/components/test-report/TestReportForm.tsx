"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import "./TestReportForm.css";
import { submitReport } from "@/services/testingService";
import { computePoint } from "@/lib/testReportCalc";
import { clearReportDraft, loadReportDraft, saveReportDraft, type SharedReportDraft } from "@/lib/reportDraft";
import {
  CAPACITY_UNITS,
  HEAD_UNITS,
  NPSHA_STATUSES,
  TEST_TYPES,
  type PumpTestReport,
  type TestType,
} from "@/types/testing";

interface PointFormValues {
  rpm: string;
  head_kgcm2: string;
  height_taken_for_filling: string;
  time_taken_to_fill_bucket_sec: string;
  capacity_direct: string;
  volts: string;
  amps: string;
  cos_phi: string;
}

interface ReportFormValues {
  model: string;
  gearbox_no: string;
  gearbox_ratio: string;
  motor: string;
  motor_rpm: string;
  suction_type: string;
  test_type: TestType;
  npsha_status: string;
  capacity_unit: string;
  head_unit: string;
  liquid: string;
  rated_capacity: string;
  rated_head: string;
  specific_gravity: string;
  viscosity_cps: string;
  k_for_given_cps: string;
  rated_rpm: string;
  q_theoretical_100rev: string;
  reference_voltage: string;
  reference_current: string;
  vnotch_baseline: string;
  tested_by: string;
  test_date: string;
  vibration_sound_db: string;
  vibration_x_mm_sec: string;
  vibration_y_mm_sec: string;
  vibration_z_mm_sec: string;
  pump_started_at: string;
  pump_stopped_at: string;
  total_run: string;
  ambient_temp_c: string;
  max_bearing_temp_c: string;
  total_rise_c: string;
  witness: string;
  inspector: string;
  recorder: string;
  remarks: string;
  points: PointFormValues[];
}

const emptyPoint: PointFormValues = {
  rpm: "",
  head_kgcm2: "",
  height_taken_for_filling: "",
  time_taken_to_fill_bucket_sec: "",
  capacity_direct: "",
  volts: "",
  amps: "",
  cos_phi: "",
};

const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));
const numOrUndef = (v: string): number | undefined => (v.trim() === "" ? undefined : Number(v));
const fmt = (v: number | null) => (v === null || Number.isNaN(v) ? "-" : v);

interface TestReportFormProps {
  /** Pre-fills and locks the model field (requisition-linked flow). Leave
   * undefined for a standalone report, which renders an editable model input. */
  lockedModel?: string;
  requisitionId?: string;
  heading: string;
  subheading: string;
  submitLabel: string;
  onSubmitted: (report: PumpTestReport) => void;
  onCancel: () => void;
}

const TestReportForm = ({
  lockedModel,
  requisitionId,
  heading,
  subheading,
  submitLabel,
  onSubmitted,
  onCancel,
}: TestReportFormProps) => {
  const [submitError, setSubmitError] = useState("");
  const scopeId = requisitionId ?? "standalone";

  const initialDraft = useRef<SharedReportDraft | null>(null);
  if (initialDraft.current === null) {
    initialDraft.current = loadReportDraft(scopeId);
  }
  const draft = initialDraft.current;

  const { register, control, handleSubmit, formState: { isSubmitting, errors } } = useForm<ReportFormValues>({
    defaultValues: {
      model: lockedModel ?? draft.model ?? "",
      liquid: draft.liquid ?? "WATER",
      test_type: (draft.test_type as TestType) ?? "V-notch",
      npsha_status: "POSITIVE",
      capacity_unit: draft.capacity_unit ?? "M3/HR",
      head_unit: draft.head_unit ?? "KG/CM2",
      rated_capacity: draft.rated_capacity ?? "",
      rated_head: draft.rated_head ?? "",
      specific_gravity: draft.specific_gravity ?? "",
      viscosity_cps: draft.viscosity_cps ?? "",
      k_for_given_cps: draft.k_for_given_cps ?? "1",
      rated_rpm: draft.rated_rpm ?? "",
      q_theoretical_100rev: draft.q_theoretical_100rev ?? "",
      tested_by: draft.tested_by ?? "",
      test_date: draft.test_date ?? "",
      vibration_sound_db: "",
      vibration_x_mm_sec: "",
      vibration_y_mm_sec: "",
      vibration_z_mm_sec: "",
      pump_started_at: "",
      pump_stopped_at: "",
      total_run: "",
      ambient_temp_c: "",
      max_bearing_temp_c: "",
      total_rise_c: "",
      witness: "",
      inspector: "",
      recorder: "",
      remarks: "",
      points: [emptyPoint],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "points" });

  const sharedFieldsWatch = useWatch({
    control,
    name: [
      "model", "test_type", "liquid", "rated_capacity", "capacity_unit", "rated_head",
      "head_unit", "specific_gravity", "viscosity_cps", "k_for_given_cps", "rated_rpm",
      "q_theoretical_100rev", "tested_by", "test_date",
    ],
  });
  useEffect(() => {
    const [model, test_type, liquid, rated_capacity, capacity_unit, rated_head, head_unit,
      specific_gravity, viscosity_cps, k_for_given_cps, rated_rpm, q_theoretical_100rev,
      tested_by, test_date] = sharedFieldsWatch;
    const nextDraft: SharedReportDraft = {
      model: lockedModel ?? model, test_type, liquid, rated_capacity, capacity_unit, rated_head,
      head_unit, specific_gravity, viscosity_cps, k_for_given_cps, rated_rpm, q_theoretical_100rev,
      tested_by, test_date,
    };
    saveReportDraft(scopeId, nextDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedFieldsWatch]);

  const testType = useWatch({ control, name: "test_type" });
  const qThVal = useWatch({ control, name: "q_theoretical_100rev" });
  const ratedRpmVal = useWatch({ control, name: "rated_rpm" });
  const kVal = useWatch({ control, name: "k_for_given_cps" });
  const baselineVal = useWatch({ control, name: "vnotch_baseline" });
  const watchedPoints = useWatch({ control, name: "points" });

  const header = {
    testType,
    qTheoretical100rev: num(qThVal ?? ""),
    ratedRpm: num(ratedRpmVal ?? ""),
    kForGivenCps: num(kVal ?? ""),
    vnotchBaseline: num(baselineVal ?? ""),
  };

  const computedRows = (watchedPoints ?? []).map((p) =>
    computePoint(
      {
        rpm: num(p?.rpm ?? ""),
        headKgcm2: num(p?.head_kgcm2 ?? ""),
        volts: num(p?.volts ?? ""),
        amps: num(p?.amps ?? ""),
        cosPhi: num(p?.cos_phi ?? ""),
        heightTakenForFilling: num(p?.height_taken_for_filling ?? ""),
        timeTakenToFillBucketSec: num(p?.time_taken_to_fill_bucket_sec ?? ""),
        capacityDirect: num(p?.capacity_direct ?? ""),
      },
      header
    )
  );

  const onSubmit = async (values: ReportFormValues) => {
    const model = (lockedModel ?? values.model).trim();
    if (!model) {
      setSubmitError("Model is required.");
      return;
    }
    setSubmitError("");
    try {
      const points = values.points.map((p, i) => {
        const computed = computedRows[i];
        return {
          rpm: num(p.rpm),
          head_kgcm2: num(p.head_kgcm2),
          head_mwc: computed.headMwc,
          vnotch_height: computed.vnotchHeight,
          initial_reading: null,
          differential_height: null,
          capacity_calculated_m3hr: computed.capacityCalculatedM3hr,
          volts: num(p.volts),
          amps: num(p.amps),
          cos_phi: num(p.cos_phi),
          power_calculated_kw: computed.powerCalculatedKw,
          theoretical_power_kw: computed.theoreticalPowerKw,
          mechanical_efficiency: computed.mechanicalEfficiency,
          theoretical_capacity_at_measured_rpm: computed.theoreticalCapacityAtMeasuredRpm,
          slip_water: computed.slipWater,
          slip_viscous: computed.slipViscous,
          theoretical_capacity_at_rated_rpm: computed.theoreticalCapacityAtRatedRpm,
          capacity_liquid_at_rated_rpm_m3hr: computed.capacityLiquidAtRatedRpmM3hr,
          capacity_liquid_at_rated_rpm_lph: computed.capacityLiquidAtRatedRpmLph,
          height_taken_for_filling: num(p.height_taken_for_filling),
          time_taken_to_fill_bucket_sec: num(p.time_taken_to_fill_bucket_sec),
          volumetric_efficiency: computed.volumetricEfficiency,
          volumetric_efficiency_liquid: null,
          mechanical_efficiency_liquid: null,
        };
      });

      const report = await submitReport({
        requisitionId,
        model,
        report_format: "observation",
        gearbox_no: values.gearbox_no || undefined,
        gearbox_ratio: values.gearbox_ratio || undefined,
        motor: values.motor || undefined,
        motor_rpm: numOrUndef(values.motor_rpm),
        suction_type: values.suction_type || undefined,
        test_type: values.test_type,
        npsha_status: values.npsha_status,
        capacity_unit: values.capacity_unit,
        head_unit: values.head_unit,
        liquid: values.liquid || undefined,
        rated_capacity: numOrUndef(values.rated_capacity),
        rated_head: numOrUndef(values.rated_head),
        specific_gravity: numOrUndef(values.specific_gravity),
        viscosity_cps: numOrUndef(values.viscosity_cps),
        k_for_given_cps: numOrUndef(values.k_for_given_cps),
        rated_rpm: numOrUndef(values.rated_rpm),
        q_theoretical_100rev: numOrUndef(values.q_theoretical_100rev),
        reference_voltage: numOrUndef(values.reference_voltage),
        reference_current: numOrUndef(values.reference_current),
        vnotch_baseline: numOrUndef(values.vnotch_baseline),
        tested_by: values.tested_by || undefined,
        test_date: values.test_date || undefined,
        vibration_sound_db: numOrUndef(values.vibration_sound_db),
        vibration_x_mm_sec: numOrUndef(values.vibration_x_mm_sec),
        vibration_y_mm_sec: numOrUndef(values.vibration_y_mm_sec),
        vibration_z_mm_sec: numOrUndef(values.vibration_z_mm_sec),
        pump_started_at: values.pump_started_at || undefined,
        pump_stopped_at: values.pump_stopped_at || undefined,
        total_run: values.total_run || undefined,
        ambient_temp_c: numOrUndef(values.ambient_temp_c),
        max_bearing_temp_c: numOrUndef(values.max_bearing_temp_c),
        total_rise_c: numOrUndef(values.total_rise_c),
        witness: values.witness || undefined,
        inspector: values.inspector || undefined,
        recorder: values.recorder || undefined,
        remarks: values.remarks || undefined,
        points,
      });
      clearReportDraft(scopeId);
      onSubmitted(report);
    } catch {
      setSubmitError("Could not submit test report. Please try again.");
    }
  };

  return (
    <div className="test-report-page">
      <h1>{heading}</h1>
      <p className="subtitle">{subheading}</p>

      {submitError && <div className="form-error-banner">{submitError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-grid">
          {lockedModel ? (
            <div className="field">
              <label>Model</label>
              <input value={lockedModel} disabled />
            </div>
          ) : (
            <div className="field">
              <label>Model *</label>
              <input {...register("model", { required: true })} placeholder="e.g. H-30" />
              {errors.model && <span className="field-error">Model is required</span>}
            </div>
          )}

          <div className="field">
            <label>Capacity Measurement Method</label>
            <select {...register("test_type")}>
              {TEST_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>NPSHa</label>
            <select {...register("npsha_status")}>
              {NPSHA_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Capacity Unit</label>
            <select {...register("capacity_unit")}>
              {CAPACITY_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Head Unit</label>
            <select {...register("head_unit")}>
              {HEAD_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Gearbox No.</label>
            <input {...register("gearbox_no")} />
          </div>
          <div className="field">
            <label>Gearbox Ratio</label>
            <input {...register("gearbox_ratio")} placeholder="e.g. 10:1" />
          </div>
          <div className="field">
            <label>Motor</label>
            <input {...register("motor")} placeholder="e.g. CGL 3HP" />
          </div>
          <div className="field">
            <label>Motor RPM</label>
            <input type="number" step="any" {...register("motor_rpm")} />
          </div>
          <div className="field">
            <label>Suction Type</label>
            <select {...register("suction_type")}>
              <option value="">-</option>
              <option value="Flooded">Flooded</option>
              <option value="Negative">Negative</option>
            </select>
          </div>
          <div className="field">
            <label>Liquid</label>
            <input {...register("liquid")} />
          </div>

          <div className="field">
            <label>Rated Capacity</label>
            <input type="number" step="any" {...register("rated_capacity")} />
          </div>
          <div className="field">
            <label>Rated Head</label>
            <input type="number" step="any" {...register("rated_head")} />
          </div>
          <div className="field">
            <label>Specific Gravity</label>
            <input type="number" step="any" {...register("specific_gravity")} />
          </div>
          <div className="field">
            <label>Viscosity (CPS)</label>
            <input type="number" step="any" {...register("viscosity_cps")} />
          </div>
          <div className="field">
            <label>K for Given CPS</label>
            <input type="number" step="any" {...register("k_for_given_cps")} />
          </div>
          <div className="field">
            <label>Rated RPM</label>
            <input type="number" step="any" {...register("rated_rpm")} />
          </div>
          <div className="field">
            <label>Q Theoretical / 100 Rev</label>
            <input type="number" step="any" {...register("q_theoretical_100rev")} />
          </div>

          <div className="field">
            <label>Reference Voltage (Vin)</label>
            <input type="number" step="any" {...register("reference_voltage")} />
          </div>
          <div className="field">
            <label>Reference Current (Iin)</label>
            <input type="number" step="any" {...register("reference_current")} />
          </div>
          <div className="field">
            <label>
              V-Notch Baseline (Hin) {testType === "V-notch" && <span className="required-hint">used for capacity calc</span>}
            </label>
            <input type="number" step="any" {...register("vnotch_baseline")} />
          </div>

          <div className="field">
            <label>Tested By</label>
            <input {...register("tested_by")} />
          </div>
          <div className="field">
            <label>Test Date</label>
            <input type="date" {...register("test_date")} />
          </div>
        </div>

        <h2 className="points-heading">
          Test Points — Capacity via {testType || "..."}
        </h2>
        <div className="points-table-wrapper">
          <table className="points-table">
            <thead>
              <tr>
                <th>RPM</th>
                <th>Head (KG/CM2)</th>
                {testType === "V-notch" && <th>Height Taken for Filling (mm)</th>}
                {testType === "Barrel" && <th>Time to Fill 5L (sec)</th>}
                {testType === "Flow Meter" && <th>Capacity (M3/Hr)</th>}
                <th>Volts</th>
                <th>Amps</th>
                <th>Cos Phi</th>
                {testType !== "Flow Meter" && <th className="computed-col">Capacity (M3/Hr)</th>}
                <th className="computed-col">Power (KW)</th>
                <th className="computed-col">VE %</th>
                <th className="computed-col">ME %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const computed = computedRows[index];
                return (
                  <tr key={field.id}>
                    <td><input type="number" step="any" {...register(`points.${index}.rpm`)} /></td>
                    <td><input type="number" step="any" {...register(`points.${index}.head_kgcm2`)} /></td>
                    {testType === "V-notch" && (
                      <td><input type="number" step="any" {...register(`points.${index}.height_taken_for_filling`)} /></td>
                    )}
                    {testType === "Barrel" && (
                      <td><input type="number" step="any" {...register(`points.${index}.time_taken_to_fill_bucket_sec`)} /></td>
                    )}
                    {testType === "Flow Meter" && (
                      <td><input type="number" step="any" {...register(`points.${index}.capacity_direct`)} /></td>
                    )}
                    <td><input type="number" step="any" {...register(`points.${index}.volts`)} /></td>
                    <td><input type="number" step="any" {...register(`points.${index}.amps`)} /></td>
                    <td><input type="number" step="any" {...register(`points.${index}.cos_phi`)} /></td>
                    {testType !== "Flow Meter" && (
                      <td className="computed-cell">{fmt(computed?.capacityCalculatedM3hr ?? null)}</td>
                    )}
                    <td className="computed-cell">{fmt(computed?.powerCalculatedKw ?? null)}</td>
                    <td className="computed-cell">{fmt(computed?.volumetricEfficiency ?? null)}</td>
                    <td className="computed-cell">{fmt(computed?.mechanicalEfficiency ?? null)}</td>
                    <td>
                      <button
                        type="button"
                        className="remove-point-btn"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="add-point-btn" onClick={() => append(emptyPoint)}>
          + Add Test Point
        </button>

        <h2 className="points-heading">Vibration Test &amp; Run Summary</h2>
        <div className="form-grid">
          <div className="field">
            <label>Vibration — Sound (Db)</label>
            <input type="number" step="any" {...register("vibration_sound_db")} />
          </div>
          <div className="field">
            <label>Vibration — X (mm/sec)</label>
            <input type="number" step="any" {...register("vibration_x_mm_sec")} />
          </div>
          <div className="field">
            <label>Vibration — Y (mm/sec)</label>
            <input type="number" step="any" {...register("vibration_y_mm_sec")} />
          </div>
          <div className="field">
            <label>Vibration — Z (mm/sec)</label>
            <input type="number" step="any" {...register("vibration_z_mm_sec")} />
          </div>

          <div className="field">
            <label>Pump Started At</label>
            <input {...register("pump_started_at")} placeholder="e.g. 11:30 AM" />
          </div>
          <div className="field">
            <label>Pump Stopped At</label>
            <input {...register("pump_stopped_at")} placeholder="e.g. 12:00 PM" />
          </div>
          <div className="field">
            <label>Total Run</label>
            <input {...register("total_run")} placeholder="e.g. 00:30 hrs" />
          </div>

          <div className="field">
            <label>Ambient Temp (°C)</label>
            <input type="number" step="any" {...register("ambient_temp_c")} />
          </div>
          <div className="field">
            <label>Max. Bearing Temp (°C)</label>
            <input type="number" step="any" {...register("max_bearing_temp_c")} />
          </div>
          <div className="field">
            <label>Total Rise (°C)</label>
            <input type="number" step="any" {...register("total_rise_c")} />
          </div>

          <div className="field">
            <label>Witness</label>
            <input {...register("witness")} />
          </div>
          <div className="field">
            <label>Inspector</label>
            <input {...register("inspector")} />
          </div>
          <div className="field">
            <label>Recorder</label>
            <input {...register("recorder")} />
          </div>
        </div>

        <h2 className="points-heading">Remarks</h2>
        <div className="form-grid">
          <div className="field field-full">
            <label>Remarks</label>
            <textarea rows={3} {...register("remarks")} placeholder="Any additional observations or comments" />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TestReportForm;
