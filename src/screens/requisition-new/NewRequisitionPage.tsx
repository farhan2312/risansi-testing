"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import "./NewRequisitionPage.css";
import { createRequisition } from "@/services/testingService";
import { REQUISITION_CATEGORIES, RESPONSIBLE_PERSONS, SOURCE_TEAMS } from "@/types/testing";

const optionalNumber = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? undefined : v), inner.optional());

const schema = z.object({
  model: z.string().min(1, "Model is required"),
  category: z.string().min(1, "Category is required"),
  ec_quotation_no: z.string().optional(),
  responsible_person: z.string().min(1, "Responsible person (RES.) is required"),
  source_team: z.string().min(1, "Source team is required"),
  date_of_receipt: z.string().optional(),
  test_qty: optionalNumber(z.coerce.number().int().positive()),
  qth: optionalNumber(z.coerce.number()),
  power_hp: optionalNumber(z.coerce.number()),
  power_kw: optionalNumber(z.coerce.number()),
  head_kgcm2: optionalNumber(z.coerce.number()),
  rpm: optionalNumber(z.coerce.number()),
  req_capacity: optionalNumber(z.coerce.number()),
});

type FormValues = z.input<typeof schema>;

const NewRequisitionPage = () => {
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: REQUISITION_CATEGORIES[0],
      source_team: SOURCE_TEAMS[0],
      responsible_person: RESPONSIBLE_PERSONS[0],
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitError("");
    try {
      const requisition = await createRequisition(schema.parse(values));
      router.push(`/requisitions/${requisition.id}`);
    } catch {
      setSubmitError("Could not create requisition. Please try again.");
    }
  };

  return (
    <div className="requisition-form-page">
      <h1>New Testing Requisition</h1>
      <p className="subtitle">Log a testing request as received from the source team.</p>

      {submitError && <div className="form-error-banner">{submitError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="model">Model *</label>
            <input id="model" {...register("model")} placeholder="e.g. H-30" />
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
            <label htmlFor="ec_quotation_no">EC/Quotation/Offer No.</label>
            <input id="ec_quotation_no" {...register("ec_quotation_no")} placeholder="N/A" />
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
            <label htmlFor="power_hp">Power (HP)</label>
            <input id="power_hp" type="number" step="any" {...register("power_hp")} />
          </div>

          <div className="field">
            <label htmlFor="power_kw">Power (KW)</label>
            <input id="power_kw" type="number" step="any" {...register("power_kw")} />
          </div>

          <div className="field">
            <label htmlFor="head_kgcm2">Head (KG/CM2)</label>
            <input id="head_kgcm2" type="number" step="any" {...register("head_kgcm2")} />
          </div>

          <div className="field">
            <label htmlFor="rpm">RPM</label>
            <input id="rpm" type="number" step="any" {...register("rpm")} />
          </div>

          <div className="field">
            <label htmlFor="req_capacity">Req. Capacity</label>
            <input id="req_capacity" type="number" step="any" {...register("req_capacity")} />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => router.push("/dashboard")}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Requisition"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewRequisitionPage;
