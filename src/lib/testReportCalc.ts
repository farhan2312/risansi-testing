/**
 * Live formula engine for the digital test-report format, ported exactly from
 * "NEW PUMP TESTING FORMATE FOR DIGITAL" (sheets "v notch" + "UPDATE SHEET
 * V-NOTCH (2)"). Every formula below was verified against sample values baked
 * into that workbook before porting — see the conversation for the check.
 */
import type { TestType } from "@/types/testing";

export interface ReportHeaderForCalc {
  testType: TestType | "";
  qTheoretical100rev: number | null; // QTH, m3/hr per 100 rev
  ratedRpm: number | null;
  kForGivenCps: number | null; // defaults to 1 (no viscosity correction) if absent
  vnotchBaseline: number | null; // Hin, mm
}

export interface PointRawInputs {
  rpm: number | null;
  headKgcm2: number | null;
  volts: number | null;
  amps: number | null;
  cosPhi: number | null;
  // Exactly one of these is meaningful, depending on header.testType:
  heightTakenForFilling: number | null; // V-notch
  timeTakenToFillBucketSec: number | null; // Barrel
  capacityDirect: number | null; // Flow Meter
}

export interface PointComputed {
  vnotchHeight: number | null;
  headMwc: number | null;
  capacityCalculatedM3hr: number | null;
  powerCalculatedKw: number | null;
  theoreticalPowerKw: number | null;
  mechanicalEfficiency: number | null;
  volumetricEfficiency: number | null;
  theoreticalCapacityAtMeasuredRpm: number | null;
  slipWater: number | null;
  slipViscous: number | null;
  theoreticalCapacityAtRatedRpm: number | null;
  capacityLiquidAtRatedRpmM3hr: number | null;
  capacityLiquidAtRatedRpmLph: number | null;
}

const round = (v: number, dp = 6) => {
  if (!Number.isFinite(v)) return null;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

/** Capacity via the V-notch weir formula: H^2.47/5320, H = height over notch (mm). */
function vnotchCapacity(heightTaken: number | null, baseline: number | null): {
  vnotchHeight: number | null;
  capacity: number | null;
} {
  if (heightTaken === null || baseline === null) return { vnotchHeight: null, capacity: null };
  const h = heightTaken - baseline;
  if (h <= 0) return { vnotchHeight: round(h, 2), capacity: null };
  return { vnotchHeight: round(h, 2), capacity: Math.pow(h, 2.47) / 5320 };
}

/** Capacity via the barrel method: 5 litres / t seconds, converted to m3/hr. */
function barrelCapacity(timeSec: number | null): number | null {
  if (!timeSec || timeSec <= 0) return null;
  return (5 / timeSec) * 3600 / 1000;
}

export function computePoint(raw: PointRawInputs, header: ReportHeaderForCalc): PointComputed {
  let vnotchHeight: number | null = null;
  let capacity: number | null = null;

  if (header.testType === "V-notch") {
    const r = vnotchCapacity(raw.heightTakenForFilling, header.vnotchBaseline);
    vnotchHeight = r.vnotchHeight;
    capacity = r.capacity;
  } else if (header.testType === "Barrel") {
    capacity = barrelCapacity(raw.timeTakenToFillBucketSec);
  } else if (header.testType === "Flow Meter") {
    capacity = raw.capacityDirect;
  }

  const headMwc = raw.headKgcm2 !== null ? raw.headKgcm2 * 10 : null;

  const power =
    raw.volts !== null && raw.amps !== null && raw.cosPhi !== null
      ? (1.7321 * raw.volts * raw.amps * raw.cosPhi) / 1000
      : null;

  const theoreticalPower =
    capacity !== null && headMwc !== null ? (capacity * headMwc) / 367 : null;

  const mechanicalEfficiency =
    theoreticalPower !== null && power !== null && power !== 0
      ? (theoreticalPower / power) * 100
      : null;

  const qth = header.qTheoretical100rev;
  const volumetricEfficiency =
    capacity !== null && raw.rpm !== null && qth !== null && raw.rpm !== 0 && qth !== 0
      ? (capacity / ((raw.rpm / 100) * qth)) * 100
      : null;

  const theoreticalCapacityAtMeasuredRpm =
    qth !== null && raw.rpm !== null ? (qth * raw.rpm) / 100 : null;

  const slipWater =
    theoreticalCapacityAtMeasuredRpm !== null && capacity !== null
      ? theoreticalCapacityAtMeasuredRpm - capacity
      : null;

  const k = header.kForGivenCps ?? 1;
  const slipViscous = slipWater !== null ? k * slipWater : null;

  const theoreticalCapacityAtRatedRpm =
    header.ratedRpm !== null && qth !== null ? (header.ratedRpm * qth) / 100 : null;

  const capacityLiquidAtRatedRpmM3hr =
    theoreticalCapacityAtRatedRpm !== null && slipViscous !== null
      ? theoreticalCapacityAtRatedRpm - slipViscous
      : null;

  const capacityLiquidAtRatedRpmLph =
    capacityLiquidAtRatedRpmM3hr !== null ? capacityLiquidAtRatedRpmM3hr * 1000 : null;

  return {
    vnotchHeight,
    headMwc: round(headMwc ?? NaN, 2),
    capacityCalculatedM3hr: round(capacity ?? NaN, 4),
    powerCalculatedKw: round(power ?? NaN, 6),
    theoreticalPowerKw: round(theoreticalPower ?? NaN, 6),
    mechanicalEfficiency: round(mechanicalEfficiency ?? NaN, 4),
    volumetricEfficiency: round(volumetricEfficiency ?? NaN, 4),
    theoreticalCapacityAtMeasuredRpm: round(theoreticalCapacityAtMeasuredRpm ?? NaN, 4),
    slipWater: round(slipWater ?? NaN, 4),
    slipViscous: round(slipViscous ?? NaN, 4),
    theoreticalCapacityAtRatedRpm: round(theoreticalCapacityAtRatedRpm ?? NaN, 4),
    capacityLiquidAtRatedRpmM3hr: round(capacityLiquidAtRatedRpmM3hr ?? NaN, 4),
    capacityLiquidAtRatedRpmLph: round(capacityLiquidAtRatedRpmLph ?? NaN, 2),
  };
}
