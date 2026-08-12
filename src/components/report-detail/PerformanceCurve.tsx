"use client";

import type { PumpTestReportPoint } from "@/types/testing";

/**
 * The three performance curves, drawn from a report's own test points -- the
 * digital equivalent of the hand-plotted Risansi curve sheets:
 *
 *   1. Capacity & Absorbed Power vs Head
 *   2. Capacity & Absorbed Power vs Speed
 *   3. Torque vs Speed        (torque = kW x 973 / RPM, per the works formula)
 *
 * A caveat on the speed-based pair: testing steps the head up while holding
 * speed roughly constant, so RPM only droops across a run (e.g. 316 -> 295 as
 * load climbs) rather than being swept 0-400 the way the catalogue sheets do.
 * The relationship is real -- capacity falls and torque rises as the pump
 * bogs down -- but the axis spans only the band actually tested, so these
 * read as a narrow slice rather than a full design curve.
 *
 * Drawn as inline SVG rather than with a chart library: reports are exported
 * via window.print(), and canvas-based charts commonly print blank or
 * rasterised, whereas SVG prints crisply. It also keeps the zero-dependency
 * status quo and picks up the theme's CSS variables for free.
 */

const WIDTH = 720;
const HEIGHT = 340;
const PAD = { top: 22, right: 68, bottom: 46, left: 62 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

/** kW -> kgf·m at a given speed, the constant the works curve sheets use. */
const TORQUE_CONSTANT = 973;

interface Series {
  key: string;
  label: string;
  /** "capacity" | "power" | "torque" -- drives the stroke colour. */
  tone: string;
  axis: "left" | "right";
  values: (number | null)[];
}

/** Rounds a max up to a readable axis top and returns evenly spaced ticks. */
const axisTicks = (min: number, max: number, tickCount = 5): { lo: number; hi: number; ticks: number[] } => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    const hi = Number.isFinite(max) && max > 0 ? max : 1;
    return { lo: 0, hi, ticks: [0, hi] };
  }
  const rawStep = (max - min) / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep || 1));
  const normalized = (rawStep || 1) / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { lo, hi, ticks };
};

const tickLabel = (v: number): string =>
  Number.isInteger(v) ? String(v) : String(Number(v.toFixed(v < 10 ? 2 : 1)));

interface ChartProps {
  title: string;
  xLabel: string;
  xValues: number[];
  /** Head starts the axis at zero like the works sheets; speed spans only the
   * band tested, since 0-400 would squash a 295-316 run into a single line. */
  xFromZero: boolean;
  series: Series[];
}

const Chart = ({ title, xLabel, xValues, xFromZero, series }: ChartProps) => {
  const live = series.filter((s) => s.values.filter((v) => v !== null).length >= 2);
  if (live.length === 0 || xValues.length < 2) return null;

  const xMin = xFromZero ? 0 : Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const xAxis = axisTicks(xMin, xMax, 6);

  const leftSeries = live.filter((s) => s.axis === "left");
  const rightSeries = live.filter((s) => s.axis === "right");

  const rangeOf = (list: Series[]) => {
    const vals = list.flatMap((s) => s.values.filter((v): v is number => v !== null));
    return vals.length ? { min: Math.min(0, ...vals), max: Math.max(...vals) } : null;
  };
  const leftRange = rangeOf(leftSeries);
  const rightRange = rangeOf(rightSeries);
  const leftAxis = leftRange ? axisTicks(leftRange.min, leftRange.max, 5) : null;
  const rightAxis = rightRange ? axisTicks(rightRange.min, rightRange.max, 5) : null;

  const x = (v: number) =>
    PAD.left + ((v - xAxis.lo) / (xAxis.hi - xAxis.lo || 1)) * PLOT_W;
  const scaler = (a: { lo: number; hi: number }) => (v: number) =>
    PAD.top + PLOT_H - ((v - a.lo) / (a.hi - a.lo || 1)) * PLOT_H;
  const yLeft = leftAxis ? scaler(leftAxis) : null;
  const yRight = rightAxis ? scaler(rightAxis) : null;

  const pathFor = (s: Series) => {
    const y = s.axis === "left" ? yLeft : yRight;
    if (!y) return "";
    return s.values
      .map((v, i) => (v === null ? null : `${x(xValues[i])},${y(v)}`))
      .filter(Boolean)
      .join(" ");
  };

  return (
    <div className="performance-curve">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
        {(leftAxis ?? rightAxis)!.ticks.map((t, i) => {
          const y = (yLeft ?? yRight)!((leftAxis ?? rightAxis)!.ticks[i]);
          return <line key={`g-${t}`} className="curve-grid" x1={PAD.left} x2={PAD.left + PLOT_W} y1={y} y2={y} />;
        })}
        {xAxis.ticks.map((t) => (
          <line key={`gx-${t}`} className="curve-grid" x1={x(t)} x2={x(t)} y1={PAD.top} y2={PAD.top + PLOT_H} />
        ))}

        <line className="curve-axis" x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + PLOT_H} />
        <line className="curve-axis" x1={PAD.left} x2={PAD.left + PLOT_W} y1={PAD.top + PLOT_H} y2={PAD.top + PLOT_H} />
        {rightAxis && (
          <line className="curve-axis" x1={PAD.left + PLOT_W} x2={PAD.left + PLOT_W} y1={PAD.top} y2={PAD.top + PLOT_H} />
        )}

        {leftAxis &&
          yLeft &&
          leftAxis.ticks.map((t) => (
            <text key={`ly-${t}`} className="curve-tick" x={PAD.left - 8} y={yLeft(t) + 4} textAnchor="end">
              {tickLabel(t)}
            </text>
          ))}
        {rightAxis &&
          yRight &&
          rightAxis.ticks.map((t) => (
            <text key={`ry-${t}`} className="curve-tick" x={PAD.left + PLOT_W + 8} y={yRight(t) + 4} textAnchor="start">
              {tickLabel(t)}
            </text>
          ))}
        {xAxis.ticks.map((t) => (
          <text key={`xt-${t}`} className="curve-tick" x={x(t)} y={PAD.top + PLOT_H + 18} textAnchor="middle">
            {tickLabel(t)}
          </text>
        ))}

        {leftSeries.length > 0 && (
          <text
            className="curve-axis-title"
            transform={`rotate(-90 14 ${PAD.top + PLOT_H / 2})`}
            x={14}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
          >
            {leftSeries.map((s) => s.label).join(" / ")}
          </text>
        )}
        {rightSeries.length > 0 && (
          <text
            className="curve-axis-title"
            transform={`rotate(90 ${WIDTH - 12} ${PAD.top + PLOT_H / 2})`}
            x={WIDTH - 12}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
          >
            {rightSeries.map((s) => s.label).join(" / ")}
          </text>
        )}
        <text className="curve-axis-title" x={PAD.left + PLOT_W / 2} y={HEIGHT - 10} textAnchor="middle">
          {xLabel}
        </text>

        {live.map((s) => (
          <polyline key={s.key} className={`curve-line curve-${s.tone}`} points={pathFor(s)} />
        ))}
        {live.map((s) => {
          const y = s.axis === "left" ? yLeft : yRight;
          if (!y) return null;
          return s.values.map((v, i) =>
            v === null ? null : (
              <circle key={`${s.key}-${i}`} className={`curve-dot curve-${s.tone}`} cx={x(xValues[i])} cy={y(v)} r={3}>
                <title>{`${xLabel} ${tickLabel(xValues[i])} — ${s.label} ${tickLabel(v)}`}</title>
              </circle>
            )
          );
        })}
      </svg>

      <div className="curve-legend">
        {live.map((s) => (
          <span key={s.key}>
            <i className={`curve-swatch curve-${s.tone}`} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const num = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);

const PerformanceCurve = ({ points }: { points: PumpTestReportPoint[] }) => {
  const rows = points
    .map((p) => {
      const rpm = num(p.rpm);
      const power = num(p.power_calculated_kw);
      return {
        head: num(p.head_kgcm2),
        rpm,
        capacity: num(p.capacity_calculated_m3hr),
        power,
        // Works formula from the curve sheets: kW x 973 / RPM.
        torque: power !== null && rpm !== null && rpm > 0 ? (power * TORQUE_CONSTANT) / rpm : null,
      };
    })
    .filter((r) => r.capacity !== null || r.power !== null);

  const byHead = rows.filter((r) => r.head !== null).sort((a, b) => (a.head as number) - (b.head as number));
  // A stopped pump isn't an operating point. Imported reports carry the odd
  // rpm=0 stub row (no head, no capacity, just a stray power figure), which
  // would otherwise drag the speed axis to zero and flatten the real band.
  const bySpeed = rows
    .filter((r) => r.rpm !== null && (r.rpm as number) > 0)
    .sort((a, b) => (a.rpm as number) - (b.rpm as number));

  const headChart = (
    <Chart
      title="Capacity &amp; Absorbed Power vs Head"
      xLabel="HEAD (Kg/Cm2)"
      xFromZero
      xValues={byHead.map((r) => r.head as number)}
      series={[
        { key: "cap-h", label: "CAPACITY (M3/Hr)", tone: "capacity", axis: "left", values: byHead.map((r) => r.capacity) },
        { key: "pow-h", label: "ABSORBED POWER (KW)", tone: "power", axis: "right", values: byHead.map((r) => r.power) },
      ]}
    />
  );

  const speedChart = (
    <Chart
      title="Capacity &amp; Absorbed Power vs Speed"
      xLabel="SPEED (RPM)"
      xFromZero={false}
      xValues={bySpeed.map((r) => r.rpm as number)}
      series={[
        { key: "cap-s", label: "CAPACITY (M3/Hr)", tone: "capacity", axis: "left", values: bySpeed.map((r) => r.capacity) },
        { key: "pow-s", label: "ABSORBED POWER (KW)", tone: "power", axis: "right", values: bySpeed.map((r) => r.power) },
      ]}
    />
  );

  const torqueChart = (
    <Chart
      title="Torque vs Speed"
      xLabel="SPEED (RPM)"
      xFromZero={false}
      xValues={bySpeed.map((r) => r.rpm as number)}
      series={[
        { key: "trq", label: "TORQUE (KgM)", tone: "torque", axis: "left", values: bySpeed.map((r) => r.torque) },
      ]}
    />
  );

  return (
    <div className="performance-curves">
      {headChart}
      {speedChart}
      {torqueChart}
    </div>
  );
};

export default PerformanceCurve;
