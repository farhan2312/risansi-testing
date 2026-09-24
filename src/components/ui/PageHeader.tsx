import type { ReactNode } from "react";

interface PageHeaderProps {
  /** A single emoji, shown in a colored circle badge (matches the rest of
   * the app's existing emoji-as-icon convention -- 🐛/✨/🔔/⏰ elsewhere --
   * rather than pulling in an icon library for this alone). */
  icon: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned action buttons/controls -- see button() below for the
   * matching Tailwind button styles. */
  actions?: ReactNode;
}

/** Shared page-header card -- icon badge + title + subtitle, optionally
 * with right-aligned actions. Every dashboard-group page renders one of
 * these at the top instead of its own ad-hoc header markup. */
const PageHeader = ({ icon, title, subtitle, actions }: PageHeaderProps) => (
  <div className="tw-reset mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-gradient-to-r from-surface to-accent-soft px-6 py-5 shadow-sm">
    <div className="flex items-start gap-4">
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xl leading-none text-white shadow-sm">
        {icon}
      </span>
      <div>
        <h1 className="m-0 text-xl font-bold text-text-h">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
  </div>
);

export default PageHeader;

/** Shared Tailwind button styles for page-header actions -- pass to
 * <button className={pageHeaderButton("primary")}>. "primary" is the
 * accent-filled call-to-action (one per header, e.g. "+ New Requisition");
 * "secondary" is for anything else (Clear Filters, Search, etc); "danger"
 * is for a destructive header action (Delete). */
export const pageHeaderButton = (variant: "primary" | "secondary" | "danger" = "secondary") => {
  const base = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  if (variant === "primary") return `${base} bg-accent text-white shadow-sm hover:bg-accent-hover`;
  if (variant === "danger") return `${base} bg-neg text-white shadow-sm hover:opacity-90`;
  return `${base} border border-border bg-surface text-text hover:bg-surface-hover`;
};
