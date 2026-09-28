import { normalizeModelKey } from "@/lib/modelKey";

/**
 * VE (Volumetric Efficiency) / ME (Mechanical Efficiency) acceptance criteria per model, as supplied
 * by the testing team. Whole percentages (95 means 95%) -- compared directly against the report's own
 * volumetric_efficiency / mechanical_efficiency point values, which are stored the same way.
 *
 * Looked up by normalizeModelKey (same "H20" / "h-20" / "H 20" match every other pump-model lookup in
 * this app uses -- see lib/modelKey.ts), so formatting differences in how a model was typed don't
 * matter. A model not in this table has no acceptance criteria to check against (met/missed is simply
 * not evaluated for it -- see veMeAcceptanceFor).
 */
const VE_ME_ACCEPTANCE: Record<string, { ve: number; me: number }> = {
  // H-series
  H20: { ve: 95, me: 40 },
  H30: { ve: 95, me: 40 },
  H40: { ve: 95, me: 40 },
  H50: { ve: 80, me: 50 },
  H60: { ve: 75, me: 45 },
  H70: { ve: 85, me: 55 },
  H80: { ve: 75, me: 50 },
  H85: { ve: 75, me: 50 },
  H90: { ve: 80, me: 55 },
  H100: { ve: 75, me: 50 },
  H105: { ve: 75, me: 55 },
  H110: { ve: 75, me: 50 },
  H120: { ve: 75, me: 50 },
  // 2H-series
  "2H15": { ve: 90, me: 45 },
  "2H20": { ve: 90, me: 45 },
  "2H30": { ve: 90, me: 45 },
  "2H40": { ve: 90, me: 45 },
  "2H60": { ve: 75, me: 50 },
  "2H70": { ve: 75, me: 50 },
  "2H85": { ve: 85, me: 50 },
  "2H90": { ve: 85, me: 50 },
  "2H100": { ve: 75, me: 50 },
  "2H105": { ve: 75, me: 50 },
  "2H110": { ve: 75, me: 50 },
  // L-series
  H20L: { ve: 90, me: 45 },
  H30L: { ve: 90, me: 45 },
  H40L: { ve: 90, me: 45 },
  H50L: { ve: 60, me: 45 },
  H60L: { ve: 75, me: 45 },
  H70L: { ve: 75, me: 35 },
  H80L: { ve: 80, me: 50 },
  // L6-series
  H60L6: { ve: 80, me: 50 },
  H70L6: { ve: 85, me: 50 },
  H85L6: { ve: 80, me: 50 },
  H90L6: { ve: 80, me: 50 },
  H100L6: { ve: 75, me: 50 },
};

const ACCEPTANCE_BY_KEY = new Map(Object.entries(VE_ME_ACCEPTANCE).map(([model, v]) => [normalizeModelKey(model), v]));

/** This model's VE/ME acceptance criteria, or null if the model isn't in the table (nothing to check
 * against -- not the same as "met"). */
export const veMeAcceptanceFor = (model: string | null | undefined): { ve: number; me: number } | null =>
  model ? (ACCEPTANCE_BY_KEY.get(normalizeModelKey(model)) ?? null) : null;
