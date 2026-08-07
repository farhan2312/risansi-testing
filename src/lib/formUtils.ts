import type { ChangeEvent } from "react";
import { MOTOR_RPM_OPTIONS } from "@/types/testing";

/** Normalizes a pump model input as the user types: uppercase, no hyphens. */
export const normalizeModelOnChange = (e: ChangeEvent<HTMLInputElement>) => {
  e.target.value = e.target.value.toUpperCase().replace(/-/g, "");
};

/**
 * Motor RPM is a fixed-choice <select> (MOTOR_RPM_OPTIONS), but values
 * loaded from the DB come back as decimal-formatted numeric strings (e.g.
 * "1440.00"). Normalize to plain "1440"/"960" so the <select> pre-selects
 * correctly; returns "" for anything that isn't one of the two options
 * (older/legacy data with a different measured RPM) so the field shows
 * blank rather than silently pre-selecting the wrong option.
 */
export const normalizeMotorRpm = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const s = String(n);
  return (MOTOR_RPM_OPTIONS as readonly string[]).includes(s) ? s : "";
};

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** A requisition's Target Date: the source team's explicit value if they set
 * one (only shown/filled for "Against R&D Trials" on the requisition form),
 * otherwise 7 days after Date of Requisition, falling back to the submission
 * date if that's also blank. Computed live rather than stored so it stays in
 * sync if Date of Requisition gets edited later. */
export const targetDateFor = (r: {
  target_date?: string | null;
  date_of_requisition?: string | null;
  created_at?: string | null;
}): { date: string; isAuto: boolean } | null => {
  if (r.target_date) return { date: r.target_date, isAuto: false };
  const base = r.date_of_requisition ?? r.created_at?.slice(0, 10);
  if (!base) return null;
  return { date: addDays(base, 7), isAuto: true };
};
