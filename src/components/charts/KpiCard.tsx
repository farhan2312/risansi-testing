"use client";

import { useId, type CSSProperties } from "react";
import Link from "next/link";
import "./charts.css";

export type KpiAccent = "blue" | "orange" | "green" | "amber";

interface KpiCardProps {
  icon: string;
  label: string;
  value: string | number;
  /** Extra context under the value ("of 42 raised", "median 3d", ...). */
  hint?: string;
  /** Omit for a display-only card (no drill-down target). */
  href?: string;
  /** Signed % change vs the previous equal-length period. */
  deltaPct?: number | null;
  /** Whether an increase is good news (reports filed) or bad (overdue). */
  upIsGood?: boolean;
  sparkline?: number[];
  /** Decorative tint for the stripe, glow, icon chip and sparkline. */
  accent?: KpiAccent;
  /** Status emphasis (overrides the accent) -- always paired with the icon + label, never color alone. */
  tone?: "neutral" | "critical" | "warning" | "good";
}

const ACCENT_VAR: Record<KpiAccent, string> = {
  blue: "var(--series-1)",
  orange: "var(--series-2)",
  green: "var(--series-3)",
  amber: "var(--series-4)",
};

const TONE_VAR: Record<string, string> = {
  critical: "var(--status-critical)",
  warning: "var(--status-warning)",
  good: "var(--status-good)",
};

const Sparkline = ({ values }: { values: number[] }) => {
  const gradientId = `spark-${useId().replace(/:/g, "")}`;
  const w = 112;
  const h = 40;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - (v / max) * (h - 10)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="flex-shrink-0 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--kpi-tint)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--kpi-tint)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="var(--kpi-tint)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--kpi-tint)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
};

const KpiCard = ({ icon, label, value, hint, href, deltaPct, upIsGood = true, sparkline, accent = "blue", tone = "neutral" }: KpiCardProps) => {
  const hasDelta = deltaPct !== undefined && deltaPct !== null && Number.isFinite(deltaPct);
  const direction = !hasDelta || deltaPct === 0 ? "flat" : (deltaPct! > 0) === upIsGood ? "good" : "bad";
  const tint = TONE_VAR[tone] ?? ACCENT_VAR[accent];

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="kpi-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="kpi-label truncate">{label}</span>
        </span>
        {href && (
          <span className="kpi-arrow" aria-hidden="true">
            &rarr;
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="kpi-value">{value}</div>
          {(hasDelta || hint) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
              {hasDelta && (
                <span className={`kpi-delta kpi-delta--${direction}`}>
                  {deltaPct! > 0 ? "▲" : deltaPct! < 0 ? "▼" : "•"} {Math.abs(Math.round(deltaPct!))}%
                </span>
              )}
              {hint && <span>{hint}</span>}
            </div>
          )}
        </div>
        {sparkline && sparkline.length > 1 && <Sparkline values={sparkline} />}
      </div>
    </>
  );

  const style = { "--kpi-tint": tint } as CSSProperties;

  return href ? (
    <Link href={href} className="viz-root kpi-card group" style={style}>
      {body}
    </Link>
  ) : (
    <div className="viz-root kpi-card" style={style}>
      {body}
    </div>
  );
};

export default KpiCard;
