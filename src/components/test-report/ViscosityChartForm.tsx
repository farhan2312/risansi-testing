"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import "./TestReportForm.css";
import { getLatestObservationReport, getRequisition, submitReport, updateReport } from "@/services/testingService";
import { computeViscosityChartPoint } from "@/lib/testReportCalc";
import {
  clearReportDraft,
  draftFromReport,
  loadReportDraft,
  saveReportDraft,
  type SharedReportDraft,
} from "@/lib/reportDraft";
import {
  TEST_TYPES,
  VISCOSITY_CAPACITY_UNITS,
  VISCOSITY_HEAD_UNITS,
  type PumpTestReport,
  type TestType,
} from "@/types/testing";

interface PointFormValues {
  rpm: string;
  head_kgcm2: string;
  height_over_vnotch: string;
  initial_reading: string;
  time_taken_to_fill_bucket_sec: string;
  capacity_direct: string;
  volts: string;
  amps: string;
  cos_phi: string;
}

interface ChartFormValues {
  model: string;
  po_no: string;
  ec_no: string;
  rev_no: string;
  rev_date: string;
  pump_serial_no: string;
  test_type: TestType;
  liquid: string;
  rated_capacity: string;
  capacity_unit: string;
  rated_head: string;
  head_unit: string;
  specific_gravity: string;
  viscosity_cps: string;
  k_for_given_cps: string;
  rated_rpm: string;
  q_theoretical_100rev: string;
  calculated_head: string;
  tested_by: string;
  test_date: string;
  remarks: string;
  points: PointFormValues[];
}

const emptyPoint: PointFormValues = {
  rpm: "",
  head_kgcm2: "",
  height_over_vnotch: "",
  initial_reading: "",
  time_taken_to_fill_bucket_sec: "",
  capacity_direct: "",
  volts: "",
  amps: "",
  cos_phi: "",
};

const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));
const numOrUndef = (v: string): number | undefined => (v.trim() === "" ? undefined : Number(v));
const fmt = (v: number | null) => (v === null || Number.isNaN(v) ? "-" : v);
const str = (v: string | number | null | undefined): string => (v === null || v === undefined ? "" : String(v));

const pointsFromExistingReport = (report: PumpTestReport): PointFormValues[] => {
  const isFlowMeter = report.test_type === "Flow Meter";
  return report.points.map((p) => ({
    rpm: str(p.rpm),
    head_kgcm2: str(p.head_kgcm2),
    height_over_vnotch: str(p.height_taken_for_filling),
    initial_reading: str(p.initial_reading),
    time_taken_to_fill_bucket_sec: str(p.time_taken_to_fill_bucket_sec),
    capacity_direct: isFlowMeter ? str(p.capacity_calculated_m3hr) : "",
    volts: str(p.volts),
    amps: str(p.amps),
    cos_phi: str(p.cos_phi),
  }));
};

interface ViscosityChartFormProps {
  lockedModel?: string;
  requisitionId?: string;
  /** Editing an already-submitted report — prefills every field (including
   * points) from it and PATCHes instead of POSTing on submit. */
  existingReport?: PumpTestReport;
  heading: string;
  subheading: string;
  submitLabel: string;
  onSubmitted: (report: PumpTestReport) => void;
  onCancel: () => void;
}

const ViscosityChartForm = ({
  lockedModel,
  requisitionId,
  existingReport,
  heading,
  subheading,
  submitLabel,
  onSubmitted,
  onCancel,
}: ViscosityChartFormProps) => {
  const [submitError, setSubmitError] = useState("");
  const [autofillNotice, setAutofillNotice] = useState("");
  const scopeId = requisitionId ?? "standalone";
  const lookedUpModel = useRef<string>("");

  const initialDraft = useRef<SharedReportDraft | null>(null);
  if (initialDraft.current === null) {
    if (existingReport) {
      initialDraft.current = {};
    } else {
      const loaded = loadReportDraft(scopeId);
      // Viscosity Chart's unit dropdowns use a different value set than the
      // Observation Sheet's — only carry a unit over if it's valid here.
      if (loaded.capacity_unit && !VISCOSITY_CAPACITY_UNITS.includes(loaded.capacity_unit as never)) {
        delete loaded.capacity_unit;
      }
      if (loaded.head_unit && !VISCOSITY_HEAD_UNITS.includes(loaded.head_unit as never)) {
        delete loaded.head_unit;
      }
      initialDraft.current = loaded;
    }
  }
  const draft = initialDraft.current;
  const r = existingReport;

  const { register, control, handleSubmit, getValues, setValue, formState: { isSubmitting, errors } } = useForm<ChartFormValues>({
    defaultValues: {
      model: lockedModel ?? r?.model ?? draft.model ?? "",
      po_no: str(r?.po_no),
      ec_no: str(r?.ec_no),
      rev_no: str(r?.rev_no),
      rev_date: str(r?.rev_date),
      pump_serial_no: str(r?.pump_serial_no),
      liquid: r?.liquid ?? draft.liquid ?? "WATER",
      test_type: (r?.test_type as TestType) ?? (draft.test_type as TestType) ?? "V-notch",
      capacity_unit: r?.capacity_unit ?? draft.capacity_unit ?? "M3/HR",
      head_unit: r?.head_unit ?? draft.head_unit ?? "MWC",
      rated_capacity: str(r?.rated_capacity) || draft.rated_capacity || "",
      rated_head: str(r?.rated_head) || draft.rated_head || "",
      specific_gravity: str(r?.specific_gravity) || draft.specific_gravity || "",
      viscosity_cps: str(r?.viscosity_cps) || draft.viscosity_cps || "",
      k_for_given_cps: str(r?.k_for_given_cps) || draft.k_for_given_cps || "1",
      rated_rpm: str(r?.rated_rpm) || draft.rated_rpm || "",
      q_theoretical_100rev: str(r?.q_theoretical_100rev) || draft.q_theoretical_100rev || "",
      calculated_head: str(r?.calculated_head),
      tested_by: r?.tested_by ?? draft.tested_by ?? "",
      test_date: r?.test_date ?? draft.test_date ?? "",
      remarks: str(r?.remarks),
      points: r ? pointsFromExistingReport(r) : [emptyPoint],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "points" });

  // Prefill from the same pump's Observation Sheet — fields the tester has
  // already typed are left alone, only currently-empty ones are filled.
  const applyAutofill = (source: Parameters<typeof draftFromReport>[0], reportNo?: string | null) => {
    const d = draftFromReport(source);
    let filledAny = false;
    const setIfEmpty = (name: keyof ChartFormValues, value?: string) => {
      if (!value || getValues(name)) return;
      setValue(name, value as never);
      filledAny = true;
    };
    setIfEmpty("test_type", d.test_type);
    setIfEmpty("liquid", d.liquid);
    if (d.capacity_unit && VISCOSITY_CAPACITY_UNITS.includes(d.capacity_unit as never)) {
      setIfEmpty("capacity_unit", d.capacity_unit);
    }
    if (d.head_unit && VISCOSITY_HEAD_UNITS.includes(d.head_unit as never)) {
      setIfEmpty("head_unit", d.head_unit);
    }
    setIfEmpty("rated_capacity", d.rated_capacity);
    setIfEmpty("rated_head", d.rated_head);
    setIfEmpty("specific_gravity", d.specific_gravity);
    setIfEmpty("viscosity_cps", d.viscosity_cps);
    setIfEmpty("k_for_given_cps", d.k_for_given_cps);
    setIfEmpty("rated_rpm", d.rated_rpm);
    setIfEmpty("q_theoretical_100rev", d.q_theoretical_100rev);
    setIfEmpty("tested_by", d.tested_by);
    setIfEmpty("test_date", d.test_date);
    if (filledAny) {
      setAutofillNotice(
        `Prefilled from the Observation Sheet${reportNo ? ` (${reportNo})` : ""} already submitted for this pump — edit anything as needed.`
      );
    }
  };

  // Requisition-linked: this exact job's Observation Sheet report (if any)
  // is the authoritative source, known as soon as the requisition loads.
  useEffect(() => {
    if (existingReport || !requisitionId) return;
    getRequisition(requisitionId)
      .then((req) => {
        const obs = req.reports?.find((rep) => (rep.report_format ?? "observation") === "observation");
        if (obs) {
          applyAutofill(obs, obs.report_no);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requisitionId, existingReport]);

  // Standalone: look up by model once the tester finishes typing it.
  const handleModelBlur = () => {
    if (existingReport || requisitionId) return;
    const modelVal = getValues("model").trim();
    if (!modelVal || modelVal === lookedUpModel.current) return;
    lookedUpModel.current = modelVal;
    getLatestObservationReport(modelVal)
      .then((obs) => {
        if (obs) applyAutofill(obs, obs.report_no);
      })
      .catch(() => {});
  };

  const sharedFieldsWatch = useWatch({
    control,
    name: [
      "model", "test_type", "liquid", "rated_capacity", "capacity_unit", "rated_head",
      "head_unit", "specific_gravity", "viscosity_cps", "k_for_given_cps", "rated_rpm",
      "q_theoretical_100rev", "tested_by", "test_date",
    ],
  });
  useEffect(() => {
    if (existingReport) return;
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
  const watchedPoints = useWatch({ control, name: "points" });

  const header = {
    testType,
    qTheoretical100rev: num(qThVal ?? ""),
    ratedRpm: num(ratedRpmVal ?? ""),
    kForGivenCps: num(kVal ?? ""),
  };

  const computedRows = (watchedPoints ?? []).map((p) =>
    computeViscosityChartPoint(
      {
        rpm: num(p?.rpm ?? ""),
        headKgcm2: num(p?.head_kgcm2 ?? ""),
        volts: num(p?.volts ?? ""),
        amps: num(p?.amps ?? ""),
        cosPhi: num(p?.cos_phi ?? ""),
        heightOverVNotch: num(p?.height_over_vnotch ?? ""),
        initialReading: num(p?.initial_reading ?? ""),
        timeTakenToFillBucketSec: num(p?.time_taken_to_fill_bucket_sec ?? ""),
        capacityDirect: num(p?.capacity_direct ?? ""),
      },
      header
    )
  );

  const onSubmit = async (values: ChartFormValues) => {
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
          vnotch_height: computed.differentialHeight,
          initial_reading: num(p.initial_reading),
          differential_height: computed.differentialHeight,
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
          height_taken_for_filling: num(p.height_over_vnotch),
          time_taken_to_fill_bucket_sec: num(p.time_taken_to_fill_bucket_sec),
          volumetric_efficiency: computed.volumetricEfficiency,
          volumetric_efficiency_liquid: computed.volumetricEfficiencyLiquid,
          mechanical_efficiency_liquid: computed.mechanicalEfficiencyLiquid,
        };
      });

      const payload = {
        model,
        report_format: "viscosity-chart" as const,
        po_no: values.po_no || undefined,
        ec_no: values.ec_no || undefined,
        rev_no: values.rev_no || undefined,
        rev_date: values.rev_date || undefined,
        pump_serial_no: values.pump_serial_no || undefined,
        test_type: values.test_type,
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
        calculated_head: numOrUndef(values.calculated_head),
        tested_by: values.tested_by || undefined,
        test_date: values.test_date || undefined,
        remarks: values.remarks || undefined,
        points,
      };

      const report = existingReport
        ? await updateReport(existingReport.id, payload)
        : await submitReport({ requisitionId, ...payload });
      if (!existingReport) clearReportDraft(scopeId);
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
      {autofillNotice && <div className="form-info-banner">{autofillNotice}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-grid">
          {lockedModel ? (
            <div className="field">
              <label>Model No.</label>
              <input value={lockedModel} disabled />
            </div>
          ) : (
            <div className="field">
              <label>Model No. *</label>
              {(() => {
                const modelReg = register("model", { required: true });
                return (
                  <input
                    {...modelReg}
                    onBlur={(e) => {
                      modelReg.onBlur(e);
                      handleModelBlur();
                    }}
                    placeholder="e.g. RMOH1115"
                  />
                );
              })()}
              {errors.model && <span className="field-error">Model is required</span>}
            </div>
          )}

          <div className="field">
            <label>PO No.</label>
            <input {...register("po_no")} />
          </div>
          <div className="field">
            <label>EC No.</label>
            <input {...register("ec_no")} />
          </div>
          <div className="field">
            <label>Rev No.</label>
            <input {...register("rev_no")} />
          </div>
          <div className="field">
            <label>Rev Date</label>
            <input type="date" {...register("rev_date")} />
          </div>
          <div className="field">
            <label>Pump S.No.</label>
            <input {...register("pump_serial_no")} />
          </div>

          <div className="field">
            <label>Type of Testing</label>
            <select {...register("test_type")}>
              {TEST_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Liquid</label>
            <input {...register("liquid")} />
          </div>

          <div className="field">
            <label>Rated Capacity</label>
            <div className="value-unit-group">
              <input type="number" step="any" {...register("rated_capacity")} />
              <select {...register("capacity_unit")}>
                {VISCOSITY_CAPACITY_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Rated Head</label>
            <div className="value-unit-group">
              <input type="number" step="any" {...register("rated_head")} />
              <select {...register("head_unit")}>
                {VISCOSITY_HEAD_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
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
            <label>Calculated Head (MWC)</label>
            <input type="number" step="any" {...register("calculated_head")} />
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
                {testType === "V-notch" && (
                  <>
                    <th>Height Over V-Notch (mm)</th>
                    <th>Initial Reading (mm)</th>
                  </>
                )}
                {testType === "Barrel" && <th>Time to Fill 5L (sec)</th>}
                {testType === "Flow Meter" && <th>Capacity (M3/Hr)</th>}
                <th>Volts</th>
                <th>Amps</th>
                <th>Cos Phi</th>
                {testType !== "Flow Meter" && <th className="computed-col">Capacity (M3/Hr)</th>}
                <th className="computed-col">Power (KW)</th>
                <th className="computed-col">ME % (Water)</th>
                <th className="computed-col">VE % (Liquid)</th>
                <th className="computed-col">ME % (Liquid)</th>
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
                      <>
                        <td><input type="number" step="any" {...register(`points.${index}.height_over_vnotch`)} /></td>
                        <td><input type="number" step="any" {...register(`points.${index}.initial_reading`)} /></td>
                      </>
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
                    <td className="computed-cell">{fmt(computed?.mechanicalEfficiency ?? null)}</td>
                    <td className="computed-cell">{fmt(computed?.volumetricEfficiencyLiquid ?? null)}</td>
                    <td className="computed-cell">{fmt(computed?.mechanicalEfficiencyLiquid ?? null)}</td>
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

export default ViscosityChartForm;
