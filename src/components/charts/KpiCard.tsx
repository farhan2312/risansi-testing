"use client";

import Link from "next/link";
import "./charts.css";

interface KpiCardProps {
  icon: string;
  label: string;
  value: string | number;
  /** Extra context under the value ("of 42 raised", "median 3d", ...). */
  hint?: string;
  href: string;
  /** Signed % change vs the previous equal-length period. */
  deltaPct?: number | null;
  /** Whether an increase is good news (reports filed) or bad (overdue). */
  upIsGood?: boolean;
  sparkline?: number[];
  /** Status emphasis -- always paired with the icon + label, never color alone. */
  tone?: "neutral" | "critical" | "warning" | "good";
}

const TONE_RING: Record<string, string> = {
  neutral: "",
  critical: "ring-1 ring-[var(--status-critical)]/40",
  warning: "ring-1 ring-[var(--status-warning)]/50",
  good: "",
};

const Sparkline = ({ values }: { values: number[] }) => {
  const w = 96;
  const h = 28;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length <= 1 ? w : (i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--text-faint)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={3} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={1.5} />}
    </svg>
  );
};

const KpiCard = ({ icon, label, value, hint, href, deltaPct, upIsGood = true, sparkline, tone = "neutral" }: KpiCardProps) => {
  const hasDelta = deltaPct !== undefined && deltaPct !== null && Number.isFinite(deltaPct);
  const good = hasDelta && (deltaPct! === 0 ? null : (deltaPct! > 0) === upIsGood);

  return (
    <Link
      href={href}
      className={`viz-root group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent-line hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${TONE_RING[tone]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium text-text-muted">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-sm" aria-hidden="true">
            {icon}
          </span>
          {label}
        </span>
        <span className="text-xs text-text-faint transition-transform group-hover:translate-x-0.5" aria-hidden="true">
          &rarr;
        </span>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[28px] font-semibold leading-none text-text-h">{value}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {hasDelta && (
              <span
                className="font-semibold"
                style={{ color: good === null ? "var(--text-muted)" : good ? "var(--pos-strong)" : "var(--neg)" }}
              >
                {deltaPct! > 0 ? "▲" : deltaPct! < 0 ? "▼" : "•"} {Math.abs(Math.round(deltaPct!))}%
              </span>
            )}
            {hint && <span className="text-text-muted">{hint}</span>}
          </div>
        </div>
        {sparkline && sparkline.length > 1 && <Sparkline values={sparkline} />}
      </div>
    </Link>
  );
};

export default KpiCard;
