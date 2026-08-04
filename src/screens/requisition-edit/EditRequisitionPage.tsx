"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useRouter } from "next/navigation";
import "../requisition-new/NewRequisitionPage.css";
import { normalizeModelOnChange } from "@/lib/formUtils";
import { capacityToM3hr, headToMwc } from "@/lib/unitConversion";
import { getRequisition, listPumpModels, updateRequisition } from "@/services/testingService";
import {
  CAPACITY_UNITS,
  ecQuotationLabel,
  HEAD_UNITS,
  REQUISITION_CATEGORIES,
  RESPONSIBLE_PERSONS,
  SOURCE_TEAMS,
} from "@/types/testing";

const ADD_NEW_MODEL = "__add_new_model__";

const optionalNumber = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : v), inner.optional());

const schema = z.object({
  model: z.string().min(1, "Model is required"),
  category: z.string().min(1, "Category is required"),
  ec_quotation_no: z.string().optional(),
  offer_date: z.string().optional(),
  responsible_person: z.string().min(1, "Responsible person (RES.) is required"),
  source_team: z.string().min(1, "Source team is required"),
  date_of_receipt: z.string().optional(),
  test_qty: optionalNumber(z.coerce.number().int().positive()),
  qth: optionalNumber(z.coerce.number()),
  specific_gravity: optionalNumber(z.coerce.number()),
  power_hp: optionalNumber(z.coerce.number()),
  power_kw: optionalNumber(z.coerce.number()),
  head_kgcm2: optionalNumber(z.coerce.number()),
  head_unit: z.string().optional(),
  rpm: optionalNumber(z.coerce.number()),
  motor_rpm: optionalNumber(z.coerce.number()),
  req_capacity: optionalNumber(z.coerce.number()),
  req_capacity_unit: z.string().optional(),
});

type FormValues = z.input<typeof schema>;

const EditRequisitionPage = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pumpModels, setPumpModels] = useState<string[]>([]);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const category = watch("category");
  const modelReg = register("model");
  const headValue = watch("head_kgcm2");
  const headUnit = watch("head_unit");
  const capacityValue = watch("req_capacity");
  const capacityUnit = watch("req_capacity_unit");
  const specificGravity = watch("specific_gravity");
  const sg = specificGravity !== undefined && specificGravity !== "" ? Number(specificGravity) : undefined;
  const headConverted =
    headValue !== undefined && headValue !== "" ? headToMwc(Number(headValue), headUnit, sg) : null;
  const capacityConverted =
    capacityValue !== undefined && capacityValue !== ""
      ? capacityToM3hr(Number(capacityValue), capacityUnit, sg)
      : null;

  useEffect(() => {
    if (!id) return;
    Promise.all([getRequisition(id), listPumpModels()])
      .then(([r, models]) => {
        setPumpModels(models);
        reset({
          model: r.model,
          category: r.category ?? REQUISITION_CATEGORIES[0],
          ec_quotation_no: r.ec_quotation_no ?? "",
          offer_date: r.offer_date ?? "",
          responsible_person: r.responsible_person ?? RESPONSIBLE_PERSONS[0],
          source_team: r.source_team ?? SOURCE_TEAMS[0],
          date_of_receipt: r.date_of_receipt ?? "",
          test_qty: r.test_qty ?? undefined,
          qth: r.qth ?? undefined,
          specific_gravity: r.specific_gravity ?? undefined,
          power_hp: r.power_hp ?? undefined,
          power_kw: r.power_kw ?? undefined,
          head_kgcm2: r.head_kgcm2 ?? undefined,
          head_unit: r.head_unit ?? "",
          rpm: r.rpm ?? undefined,
          motor_rpm: r.motor_rpm ?? undefined,
          req_capacity: r.req_capacity ?? undefined,
          req_capacity_unit: r.req_capacity_unit ?? "",
        });
      })
      .catch(() => setSubmitError("Could not load testing summary."))
      .finally(() => setIsLoading(false));
  }, [id, reset]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError("");
    try {
      await updateRequisition(id, schema.parse(values));
      router.push(`/requisitions/${id}`);
    } catch {
      setSubmitError("Could not update testing summary. Please try again.");
    }
  };

  if (isLoading) return <p className="detail-empty">Loading...</p>;

  return (
    <div className="requisition-form-page">
      <div className="sticky-page-header">
        <h1>Edit Testing Summary</h1>
        <p className="subtitle">Correct the intake details for this testing summary.</p>
      </div>

      {submitError && <div className="form-error-banner">{submitError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="model">Model *</label>
            {isCustomModel ? (
              <input
                id="model"
                {...modelReg}
                onChange={(e) => {
                  normalizeModelOnChange(e);
                  modelReg.onChange(e);
                }}
                placeholder="Enter new model"
                autoFocus
              />
            ) : (
              <select
                id="model"
                {...modelReg}
                onChange={(e) => {
                  if (e.target.value === ADD_NEW_MODEL) {
                    setIsCustomModel(true);
                    setValue("model", "");
                  } else {
                    modelReg.onChange(e);
                  }
                }}
              >
                {pumpModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value={ADD_NEW_MODEL}>+ Add New Model...</option>
              </select>
            )}
            {isCustomModel && (
              <button
                type="button"
                className="model-mode-toggle"
                onClick={() => {
                  setIsCustomModel(false);
                  setValue("model", pumpModels[0] ?? "");
                }}
              >
                Choose from list instead
              </button>
            )}
            {errors.model && <span className="field-error">{errors.model.message}</span>}
          </div>

          <div className="field">
            <label htmlFor="category">Category *</label>
            <select id="category" {...register("category")}>
              {REQUISITION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="source_team">Source Team *</label>
            <select id="source_team" {...register("source_team")}>
              {SOURCE_TEAMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="ec_quotation_no">{ecQuotationLabel(category)}</label>
            <input id="ec_quotation_no" {...register("ec_quotation_no")} placeholder="N/A" />
          </div>

          <div className="field">
            <label htmlFor="offer_date">Offer Date</label>
            <input id="offer_date" type="date" {...register("offer_date")} />
          </div>

          <div className="field">
            <label htmlFor="responsible_person">Responsible Person (RES.) *</label>
            <select id="responsible_person" {...register("responsible_person")}>
              {RESPONSIBLE_PERSONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {errors.responsible_person && (
              <span className="field-error">{errors.responsible_person.message}</span>
            )}
          </div>

          <div className="field">
            <label htmlFor="date_of_receipt">Date of Receipt</label>
            <input id="date_of_receipt" type="date" {...register("date_of_receipt")} />
          </div>

          <div className="field">
            <label htmlFor="test_qty">Test Qty</label>
            <input id="test_qty" type="number" {...register("test_qty")} />
          </div>

          <div className="field">
            <label htmlFor="qth">QTH</label>
            <input id="qth" type="number" step="any" {...register("qth")} />
          </div>

          <div className="field">
            <label htmlFor="specific_gravity">Specific Gravity</label>
            <input
              id="specific_gravity"
              type="number"
              step="any"
              placeholder="1 (water)"
              {...register("specific_gravity")}
            />
          </div>

          <div className="field">
            <label htmlFor="power_hp">Power (HP)</label>
            <input id="power_hp" type="number" step="any" {...register("power_hp")} />
          </div>

          <div className="field">
            <label htmlFor="power_kw">Power (KW)</label>
            <input id="power_kw" type="number" step="any" {...register("power_kw")} />
          </div>

          <div className="field">
            <label htmlFor="head_kgcm2">Head</label>
            <input id="head_kgcm2" type="number" step="any" {...register("head_kgcm2")} />
            {headConverted !== null && <span className="unit-hint">= {headConverted} MWC</span>}
          </div>

          <div className="field">
            <label htmlFor="head_unit">Head Unit</label>
            <select id="head_unit" {...register("head_unit")}>
              <option value="">Select</option>
              {HEAD_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="rpm">RPM</label>
            <input id="rpm" type="number" step="any" {...register("rpm")} />
          </div>

          <div className="field">
            <label htmlFor="motor_rpm">Motor RPM</label>
            <input id="motor_rpm" type="number" step="any" {...register("motor_rpm")} />
          </div>

          <div className="field">
            <label htmlFor="req_capacity">Req. Capacity</label>
            <input id="req_capacity" type="number" step="any" {...register("req_capacity")} />
            {capacityConverted !== null && <span className="unit-hint">= {capacityConverted} M3/HR</span>}
          </div>

          <div className="field">
            <label htmlFor="req_capacity_unit">Capacity Unit</label>
            <select id="req_capacity_unit" {...register("req_capacity_unit")}>
              <option value="">Select</option>
              {CAPACITY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => router.push(`/requisitions/${id}`)}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditRequisitionPage;
