"use client";

import { presetLabel, presetValue, type DateRangeValue, type PresetKey } from "@/lib/dateRangePresets";

interface DateRangeFilterProps {
  presets: Exclude<PresetKey, "custom">[];
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}

/** Preset pill group + a From -> To box, side by side. Renders a fragment so
 * the parent decides the row (and whatever else sits on it). */
const DateRangeFilter = ({ presets, value, onChange }: DateRangeFilterProps) => (
  <>
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-surface p-1" role="group" aria-label="Date range">
      {presets.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(presetValue(key))}
          aria-pressed={value.preset === key}
          className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
            value.preset === key ? "bg-accent text-white shadow-sm" : "text-text-muted hover:bg-surface-hover hover:text-text"
          }`}
        >
          {presetLabel(key)}
        </button>
      ))}
    </div>

    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0 text-text-faint"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, preset: "custom", from: e.target.value })}
        className="bg-transparent text-sm text-text outline-none"
        aria-label="From date"
      />
      <span className="text-text-faint" aria-hidden="true">
        →
      </span>
      <input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, preset: "custom", to: e.target.value })}
        className="bg-transparent text-sm text-text outline-none"
        aria-label="To date"
      />
    </div>
  </>
);

export default DateRangeFilter;
