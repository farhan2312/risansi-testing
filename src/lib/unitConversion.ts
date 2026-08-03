/**
 * Live "converted to base unit" hints for the requisition form's Req.
 * Capacity and Head fields — display only, never written back to the
 * stored value (see CAPACITY_UNITS / HEAD_UNITS in types/testing.ts).
 *
 * Mass-based units (MT/HR, KG/MIN, TPH, MLC) assume water (SG = 1), since
 * the requisition form doesn't collect Specific Gravity that early. Matches
 * the app's existing default liquid elsewhere.
 */

const CAPACITY_TO_M3HR: Record<string, number> = {
  "M3/HR": 1,
  "MT/HR": 1, // 1 metric ton water = 1 m3
  LPH: 0.001,
  "KG/MIN": 0.06, // kg/min -> kg/hr (x60) -> m3/hr water (/1000)
  TPH: 1, // tons/hr water = m3/hr
};

const HEAD_TO_MWC: Record<string, number> = {
  MWC: 1,
  MLC: 1, // meters of liquid column, assuming water
  "KG/CM2": 10, // 1 kgf/cm2 = 10 m water column
  MTR: 1,
  TPH: 1, // not a real head unit, but present in HEAD_UNITS -- treated as identity
};

const round = (n: number) => Math.round(n * 10000) / 10000;

export const capacityToM3hr = (value: number | undefined | null, unit: string | undefined | null): number | null => {
  if (value === undefined || value === null || Number.isNaN(value) || !unit) return null;
  const factor = CAPACITY_TO_M3HR[unit];
  return factor === undefined ? null : round(value * factor);
};

export const headToMwc = (value: number | undefined | null, unit: string | undefined | null): number | null => {
  if (value === undefined || value === null || Number.isNaN(value) || !unit) return null;
  const factor = HEAD_TO_MWC[unit];
  return factor === undefined ? null : round(value * factor);
};
