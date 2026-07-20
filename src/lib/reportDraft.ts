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
