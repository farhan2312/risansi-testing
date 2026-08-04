/**
 * Did testing actually reach the pump's rated requirements? A report is
 * still valid/submittable even if it didn't -- this is a flag, not a
 * validation error. "Met" means the highest value recorded across all test
 * points reached at least the rated target; there's no rated target to
 * compare against (met is null) if the field wasn't filled in.
 */

export interface RequirementInputs {
  rated_head: number | null;
  rated_capacity: number | null;
  rated_power_kw: number | null;
}

export interface RequirementPoints {
  head_kgcm2: number | null;
  capacity_calculated_m3hr: number | null;
  power_calculated_kw: number | null;
}

export interface RequirementStatus {
  head: boolean | null;
  capacity: boolean | null;
  power: boolean | null;
}

const maxOf = (points: RequirementPoints[], field: keyof RequirementPoints): number | null => {
  const values = points.map((p) => p[field]).filter((v): v is number => v !== null && v !== undefined);
  return values.length ? Math.max(...values) : null;
};

/** null = no rated target to check against; true/false = met / not met. */
export const computeRequirementStatus = (
  report: RequirementInputs,
  points: RequirementPoints[]
): RequirementStatus => {
  const check = (rated: number | null, field: keyof RequirementPoints): boolean | null => {
    if (rated === null || rated === undefined) return null;
    const max = maxOf(points, field);
    if (max === null) return null;
    return max >= rated;
  };
  return {
    head: check(report.rated_head, "head_kgcm2"),
    capacity: check(report.rated_capacity, "capacity_calculated_m3hr"),
    power: check(report.rated_power_kw, "power_calculated_kw"),
  };
};

/** Rated power in kW from a requisition's Power (HP) / Power (KW) fields --
 * KW is used directly if present, otherwise HP is converted (1 HP = 0.7457 kW). */
export const ratedPowerKwFromRequisition = (requisition: {
  power_kw?: number | string | null;
  power_hp?: number | string | null;
}): number | undefined => {
  if (requisition.power_kw !== null && requisition.power_kw !== undefined && requisition.power_kw !== "") {
    return Number(requisition.power_kw);
  }
  if (requisition.power_hp !== null && requisition.power_hp !== undefined && requisition.power_hp !== "") {
    return Math.round(Number(requisition.power_hp) * 0.7457 * 10000) / 10000;
  }
  return undefined;
};
