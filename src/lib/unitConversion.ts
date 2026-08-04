/**
 * Live "converted to base unit" hints for the requisition form's Req.
 * Capacity and Head fields — display only, never written back to the
 * stored value (see CAPACITY_UNITS / HEAD_UNITS in types/testing.ts).
 *
 * Mass-based units (MT/HR, KG/MIN, TPH for capacity; MLC for head) need the
 * liquid's Specific Gravity to convert correctly -- density = SG x 1000
 * kg/m3. Defaults to 1 (water) when Specific Gravity hasn't been entered,
 * matching the app's existing default liquid elsewhere. KG/CM2 -> MWC is a
 * pure pressure conversion and doesn't depend on SG.
 */

const round = (n: number) => Math.round(n * 10000) / 10000;

const capacityFactor = (unit: string, sg: number): number | undefined => {
  switch (unit) {
    case "M3/HR":
      return 1;
    case "LPH":
      return 0.001;
    case "MT/HR": // mass water-equivalent tons/hr -> m3/hr
    case "TPH":
      return 1 / sg;
    case "KG/MIN": // kg/min -> kg/hr (x60) -> m3/hr (/1000/sg)
      return 0.06 / sg;
    default:
      return undefined;
  }
};

const headFactor = (unit: string, sg: number): number | undefined => {
  switch (unit) {
    case "MWC":
      return 1;
    case "MLC": // meters of liquid column -> meters of water column
      return sg;
    case "KG/CM2": // 1 kgf/cm2 = 10 m water column, independent of SG
      return 10;
    case "MTR":
      return 1;
    case "TPH": // not a real head unit, but present in HEAD_UNITS -- treated as identity
      return 1;
    default:
      return undefined;
  }
};

export const capacityToM3hr = (
  value: number | undefined | null,
  unit: string | undefined | null,
  specificGravity?: number | undefined | null
): number | null => {
  if (value === undefined || value === null || Number.isNaN(value) || !unit) return null;
  const sg = specificGravity && specificGravity > 0 ? specificGravity : 1;
  const factor = capacityFactor(unit, sg);
  return factor === undefined ? null : round(value * factor);
};

export const headToMwc = (
  value: number | undefined | null,
  unit: string | undefined | null,
  specificGravity?: number | undefined | null
): number | null => {
  if (value === undefined || value === null || Number.isNaN(value) || !unit) return null;
  const sg = specificGravity && specificGravity > 0 ? specificGravity : 1;
  const factor = headFactor(unit, sg);
  return factor === undefined ? null : round(value * factor);
};
