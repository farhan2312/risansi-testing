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
