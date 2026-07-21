/**
 * Carries the header fields shared between the two report formats
 * (Observation Sheet / Viscosity Correction Chart) across a format switch,
 * so a tester who fills one and then picks the other doesn't retype them.
 *
 * Session-scoped (sessionStorage): survives navigating between the choice
 * screen and either form in the same tab, cleared on successful submit and
 * when the browser tab closes. Keyed per requisition so unrelated reports
 * don't bleed into each other.
 */

export interface SharedReportDraft {
  model?: string;
  test_type?: string;
  liquid?: string;
  rated_capacity?: string;
  capacity_unit?: string;
  rated_head?: string;
  head_unit?: string;
  specific_gravity?: string;
  viscosity_cps?: string;
  k_for_given_cps?: string;
  rated_rpm?: string;
  q_theoretical_100rev?: string;
  tested_by?: string;
  test_date?: string;
}

const draftKey = (scopeId: string) => `test-report-draft:${scopeId}`;

export function loadReportDraft(scopeId: string): SharedReportDraft {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(draftKey(scopeId));
    return raw ? (JSON.parse(raw) as SharedReportDraft) : {};
  } catch {
    return {};
  }
}

export function saveReportDraft(scopeId: string, draft: SharedReportDraft) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(draftKey(scopeId), JSON.stringify(draft));
  } catch {
    // sessionStorage unavailable (private mode etc.) — carrying values over is
    // a convenience, not a requirement, so fail silently.
  }
}

export function clearReportDraft(scopeId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(draftKey(scopeId));
}

/** Same shared fields, sourced from an already-submitted report (typically an
 * Observation Sheet) instead of sessionStorage — used to prefill the
 * Viscosity Correction Chart form for the same pump across sessions/days,
 * not just within one browser tab. */
export function draftFromReport(report: {
  model: string;
  test_type: string | null;
  liquid: string | null;
  rated_capacity: number | string | null;
  capacity_unit: string | null;
  rated_head: number | string | null;
  head_unit: string | null;
  specific_gravity: number | string | null;
  viscosity_cps: number | string | null;
  k_for_given_cps: number | string | null;
  rated_rpm: number | string | null;
  q_theoretical_100rev: number | string | null;
  tested_by: string | null;
  test_date: string | null;
}): SharedReportDraft {
  const s = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));
  return {
    model: report.model,
    test_type: s(report.test_type),
    liquid: s(report.liquid),
    rated_capacity: s(report.rated_capacity),
    capacity_unit: s(report.capacity_unit),
    rated_head: s(report.rated_head),
    head_unit: s(report.head_unit),
    specific_gravity: s(report.specific_gravity),
    viscosity_cps: s(report.viscosity_cps),
    k_for_given_cps: s(report.k_for_given_cps),
    rated_rpm: s(report.rated_rpm),
    q_theoretical_100rev: s(report.q_theoretical_100rev),
    tested_by: s(report.tested_by),
    test_date: s(report.test_date),
  };
}
