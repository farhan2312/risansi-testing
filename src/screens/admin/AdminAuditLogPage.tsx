"use client";

import { useEffect, useMemo, useState } from "react";
import { auditExportUrl, getAuditSummary } from "@/services/adminService";
import HeroHeader, { HeroStat } from "@/components/ui/HeroHeader";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { presetValue, type DateRangeValue, type PresetKey } from "@/lib/dateRangePresets";
import AuditOverviewTab from "./audit/AuditOverviewTab";
import { ActivityTab, SessionsTab, UsageTab } from "./audit/AuditTables";
import type { AuditRange, AuditSummary } from "@/types/testing";

type Tab = "overview" | "usage" | "activity" | "sessions" | "access";

const TABS: { value: Tab; label: string; icon: string }[] = [
  { value: "overview", label: "Overview", icon: "📊" },
  { value: "usage", label: "Usage by User", icon: "👥" },
  { value: "activity", label: "Activity", icon: "⚡" },
  { value: "sessions", label: "Logins & Sessions", icon: "🔐" },
  { value: "access", label: "Access Changes", icon: "🛡️" },
];

const AUDIT_PRESETS: Exclude<PresetKey, "custom">[] = ["today", "week", "month", "7d", "30d", "all"];

const AdminAuditLogPage = () => {
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => presetValue("7d"));

  useEffect(() => {
    getAuditSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  // Stable identity per (from, to) so each tab's fetch effect only re-runs on a real change.
  const range: AuditRange = useMemo(
    () => ({ from: dateRange.from || undefined, to: dateRange.to || undefined }),
    [dateRange.from, dateRange.to]
  );
  const exportHref = auditExportUrl(range);

  const rangeText =
    dateRange.preset === "all" || (!dateRange.from && !dateRange.to)
      ? "all time"
      : `${dateRange.from || "the beginning"} → ${dateRange.to || "today"}`;

  return (
    <div className="tw-reset mx-auto flex max-w-[1400px] flex-col gap-5 p-2">
      {/* Title + export on top, the trailing-24h strip in the frosted band. */}
      <HeroHeader
        icon="🛡️"
        eyebrow="Admin · Security"
        title="Audit Log"
        subtitle="Full activity trail · who signed in, from where, and everything they did"
        actions={
          <a href={exportHref} download className="hero-btn" title={`Download ${rangeText} as CSV`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Generate Report
          </a>
        }
      >
        <div className="grid grid-cols-2 divide-x divide-border lg:grid-cols-4">
          <HeroStat icon="🔑" label="Sign-ins" chip="24H" value={summary?.logins_24h ?? "–"} tint="var(--accent)" />
          <HeroStat icon="⚠️" label="Failed" chip="24H" value={summary?.failed_24h ?? "–"} critical={!!summary && summary.failed_24h > 0} tint="var(--neg)" />
          <HeroStat icon="👥" label="Active users" chip="24H" value={summary?.active_users_24h ?? "–"} tint="var(--pos)" />
          <HeroStat icon="⚡" label="Actions" chip="24H" value={summary?.actions_24h ?? "–"} tint="var(--warn)" />
        </div>
      </HeroHeader>

      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="Audit Log sections">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.value ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* One filter row above everything it scopes. */}
      <div className="flex flex-wrap items-center gap-3">
        <DateRangeFilter presets={AUDIT_PRESETS} value={dateRange} onChange={setDateRange} />
        <span className="ml-auto text-xs text-text-muted">Showing {rangeText} · times in IST</span>
      </div>

      {tab === "overview" && <AuditOverviewTab range={range} />}
      {tab === "usage" && <UsageTab range={range} />}
      {tab === "activity" && <ActivityTab key="activity" range={range} />}
      {tab === "sessions" && <SessionsTab range={range} />}
      {tab === "access" && <ActivityTab key="access" range={range} entity="user" />}
    </div>
  );
};

export default AdminAuditLogPage;
