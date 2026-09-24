/**
 * Category for a test REPORT. Reports don't carry a category themselves --
 * only requisitions do -- so a report takes it from:
 *
 *   1. its own linked requisition, when it has one (only a handful do; almost
 *      all reports are legacy Excel/PDF imports with no requisition), else
 *   2. the requisitions raised for the same pump model (same normalized key
 *      Report Compilation groups by), when they all agree on one category.
 *
 * When a model's requisitions span several categories the report can't be
 * placed honestly, so it lands in "multiple"; when no requisition exists for
 * that model at all it lands in "none". Both stay visible as their own
 * buckets rather than being quietly folded into a real category.
 */
import { normalizeModelKey } from "@/lib/modelKey";
import { REQUISITION_CATEGORIES } from "@/types/testing";

export const REPORT_CATEGORY_MULTIPLE = "multiple";
export const REPORT_CATEGORY_NONE = "none";

/** Display order for the category-wise reports view. */
export const REPORT_CATEGORY_ORDER: string[] = [...REQUISITION_CATEGORIES, REPORT_CATEGORY_MULTIPLE, REPORT_CATEGORY_NONE];

export const reportCategoryLabel = (key: string): string =>
  key === REPORT_CATEGORY_MULTIPLE ? "Multiple categories" : key === REPORT_CATEGORY_NONE ? "No requisition on record" : key;

export const isReportCategoryKey = (value: string | null | undefined): value is string =>
  !!value && REPORT_CATEGORY_ORDER.includes(value);

interface CategorySource {
  id: string;
  model: string;
  category: string | null;
}

/** Build once from every requisition, then call per report. */
export function buildReportCategoryResolver(requisitions: CategorySource[]) {
  const categoryById = new Map(requisitions.map((r) => [r.id, r.category]));
  const categoriesByModel = new Map<string, Set<string>>();
  for (const r of requisitions) {
    const key = normalizeModelKey(r.model);
    const set = categoriesByModel.get(key) ?? new Set<string>();
    if (r.category) set.add(r.category);
    categoriesByModel.set(key, set);
  }

  return (report: { requisitionId: string | null; model: string }): string => {
    const linked = report.requisitionId ? categoryById.get(report.requisitionId) : null;
    if (linked) return linked;

    const categories = categoriesByModel.get(normalizeModelKey(report.model));
    if (!categories || categories.size === 0) return REPORT_CATEGORY_NONE;
    if (categories.size === 1) return [...categories][0];
    return REPORT_CATEGORY_MULTIPLE;
  };
}
