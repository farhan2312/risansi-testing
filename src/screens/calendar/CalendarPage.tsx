"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonPage } from "@/components/ui/Skeleton";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import { canManageCalendar } from "@/lib/calendarPermissions";
import { listCalendarEvents, deleteCalendarEvent } from "@/services/calendarService";
import { localIsoDay } from "@/lib/dateRangePresets";
import { RESPONSIBLE_PERSONS, type CalendarEvent } from "@/types/testing";
import CalendarEventModal from "./CalendarEventModal";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** Week view's rows: one per Responsible Person. Every event belongs to one of them. */
const CALENDAR_ROWS = RESPONSIBLE_PERSONS;

/** Every calendar date cell the month grid needs, Monday-first (same week convention
 * dateRangePresets.ts uses), including the tail end of the previous/next month so every row has 7 days. */
const monthGridDays = (year: number, month: number): Date[] => {
  const first = new Date(year, month, 1);
  // getDay(): 0 = Sunday .. 6 = Saturday -> how many days back to the Monday on/before the 1st.
  const back = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - back);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
};

/** The Monday-Sunday week containing `date`. */
const weekDays = (date: Date): Date[] => {
  const back = (date.getDay() + 6) % 7;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - back);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
};

const formatTimeRange = (e: CalendarEvent) => {
  if (!e.start_time) return null;
  return e.end_time ? `${e.start_time} – ${e.end_time}` : e.start_time;
};

/** Status sets both the card's accent color and its badge -- the same visual rule used consistently
 * across the card, never color alone (the badge always carries the word too). */
const STATUS_STYLE: Record<CalendarEvent["status"], { border: string; bg: string; badge: string }> = {
  Completed: { border: "border-l-pos-strong", bg: "bg-pos-soft", badge: "bg-pos text-white" },
  Planned: { border: "border-l-accent", bg: "bg-accent-soft", badge: "bg-accent text-white" },
};

const dayLabel = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

const CalendarPage = () => {
  const { user } = useAuth();
  // Everyone signed in can view the calendar; only Admin can manage it (create/update/delete) -- the
  // API itself enforces the same rule, this just decides what controls the page even offers.
  const canManage = canManageCalendar(user?.role);

  const today = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | CalendarEvent["status"]>("All");

  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [creatingOn, setCreatingOn] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const days = useMemo(
    () => (mode === "week" ? weekDays(cursor) : monthGridDays(cursor.getFullYear(), cursor.getMonth())),
    [mode, cursor]
  );
  const rangeFrom = localIsoDay(days[0]);
  const rangeTo = localIsoDay(days[days.length - 1]);

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");
    listCalendarEvents({ from: rangeFrom, to: rangeTo })
      .then((result) => {
        if (!cancelled) setEvents(result);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the calendar.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeFrom, rangeTo, reloadKey]);

  const visibleEvents = useMemo(
    () => (statusFilter === "All" ? events : events.filter((e) => e.status === statusFilter)),
    [events, statusFilter]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of visibleEvents) map.set(e.event_date, [...(map.get(e.event_date) ?? []), e]);
    return map;
  }, [visibleEvents]);

  // Week view: person -> day -> events, so each row only ever shows its own person's events.
  const eventsByPersonAndDay = useMemo(() => {
    const map = new Map<string, Map<string, CalendarEvent[]>>();
    for (const person of CALENDAR_ROWS) map.set(person, new Map());
    for (const e of visibleEvents) {
      const byDay = e.responsible_person ? map.get(e.responsible_person) : undefined;
      if (byDay) byDay.set(e.event_date, [...(byDay.get(e.event_date) ?? []), e]);
    }
    return map;
  }, [visibleEvents]);

  const todayIso = localIsoDay(today);
  const monthIndex = cursor.getMonth();
  const completedCount = visibleEvents.filter((e) => e.status === "Completed").length;
  const completedPct = visibleEvents.length ? Math.round((completedCount / visibleEvents.length) * 100) : 0;

  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const goPrev = () => setCursor(mode === "week" ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7) : new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(mode === "week" ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7) : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteCalendarEvent(deleting.id);
      setDeleting(null);
      load();
    } catch {
      setError("Could not delete the event. Please try again.");
      setIsDeleting(false);
    }
  };

  if (isLoading && events.length === 0) return <SkeletonPage />;

  const rangeTitle =
    mode === "week"
      ? `Week of ${dayLabel(days[0])} – ${dayLabel(days[6])}`
      : `${MONTH_NAMES[monthIndex]} ${cursor.getFullYear()}`;

  return (
    <div className="tw-reset mx-auto flex max-w-[1500px] flex-col gap-4 p-2">
      <PageHeader
        icon="📅"
        title="Testing Calendar"
        subtitle={canManage ? "Pump-testing events · you can add, edit and delete these" : "Pump-testing events · view-only (an admin maintains this calendar)"}
        actions={
          <div className="flex items-center gap-2">
            <div className="range-group" role="group" aria-label="View">
              <button type="button" className="range-pill" aria-pressed={mode === "week"} onClick={() => setMode("week")}>
                Week
              </button>
              <button type="button" className="range-pill" aria-pressed={mode === "month"} onClick={() => setMode("month")}>
                Month
              </button>
            </div>
            <button type="button" onClick={goPrev} className="hero-btn hero-btn--secondary" aria-label={mode === "week" ? "Previous week" : "Previous month"}>
              ← Prev
            </button>
            <button type="button" onClick={goToday} className="hero-btn hero-btn--secondary">
              Today
            </button>
            <button type="button" onClick={goNext} className="hero-btn hero-btn--secondary" aria-label={mode === "week" ? "Next week" : "Next month"}>
              Next →
            </button>
            {canManage && (
              <button type="button" onClick={() => setCreatingOn(todayIso)} className="hero-btn">
                + New Event
              </button>
            )}
          </div>
        }
      />

      {error && <p className="text-sm font-medium text-neg">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <span className="viz-root inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text">
          {visibleEvents.length} event{visibleEvents.length === 1 ? "" : "s"}
        </span>
        {visibleEvents.length > 0 && (
          <span className="viz-root inline-flex items-center gap-1.5 rounded-full bg-pos-soft px-3 py-1 text-xs font-semibold text-pos-strong">
            {completedPct}% done
          </span>
        )}
        <div className="range-group" role="group" aria-label="Status">
          {(["All", "Planned", "Completed"] as const).map((s) => (
            <button key={s} type="button" className="range-pill" aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="viz-root rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="m-0 mb-3 text-lg font-bold text-text-h">{rangeTitle}</h2>

        {mode === "week" ? (
          <div className={`overflow-x-auto transition-opacity ${isLoading ? "opacity-60" : ""}`}>
            <div className="grid min-w-[900px] grid-cols-[140px_repeat(7,1fr)] gap-px overflow-hidden rounded-lg border border-border bg-border">
              <div className="bg-bg-sunk px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Person</div>
              {days.map((day) => {
                const iso = localIsoDay(day);
                return (
                  <div key={iso} className={`px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide ${iso === todayIso ? "bg-accent-soft text-accent-ink" : "bg-bg-sunk text-text-muted"}`}>
                    {day.toLocaleDateString("en-GB", { weekday: "short" })}, {day.getDate()} {MONTH_NAMES[day.getMonth()].slice(0, 3)}
                  </div>
                );
              })}

              {CALENDAR_ROWS.map((person) => (
                <Fragment key={person}>
                  <div className="flex flex-col justify-center bg-surface px-2 py-2">
                    <span className="text-sm font-bold text-text-h">{person}</span>
                  </div>
                  {days.map((day) => {
                    const iso = localIsoDay(day);
                    const cellEvents = eventsByPersonAndDay.get(person)?.get(iso) ?? [];
                    return (
                      <div key={`${person}-${iso}`} className={`flex min-h-[92px] flex-col gap-1.5 bg-surface p-1.5 ${iso === todayIso ? "bg-accent-soft/20" : ""}`}>
                        {cellEvents.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setEditing(e)}
                            className={`group relative rounded-md border-l-[3px] ${STATUS_STYLE[e.status].border} ${STATUS_STYLE[e.status].bg} px-2 py-1.5 text-left shadow-sm hover:brightness-95`}
                          >
                            <div className="truncate pr-4 text-[12px] font-semibold text-text-h">{e.title}</div>
                            <div className="truncate text-[11px] text-text-muted">
                              {e.ec_quotation_no ? `EC ${e.ec_quotation_no}` : e.model ? e.model : formatTimeRange(e) ? "Event" : "Event"}
                              {formatTimeRange(e) && ` · ${formatTimeRange(e)}`}
                            </div>
                            <span className={`mt-1 inline-block rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${STATUS_STYLE[e.status].badge}`}>{e.status}</span>
                            {canManage && (
                              <span
                                className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded text-text-muted opacity-0 group-hover:opacity-100"
                                title="Edit"
                                aria-hidden="true"
                              >
                                ✎
                              </span>
                            )}
                          </button>
                        ))}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setCreatingOn(iso)}
                            className="rounded-md border border-dashed border-border py-1 text-[11px] text-text-faint hover:border-accent hover:text-accent"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        ) : (
          <div className={`grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border transition-opacity ${isLoading ? "opacity-60" : ""}`}>
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-bg-sunk px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {d}
              </div>
            ))}

            {days.map((day) => {
              const iso = localIsoDay(day);
              const inMonth = day.getMonth() === monthIndex;
              const isToday = iso === todayIso;
              const dayEvents = eventsByDay.get(iso) ?? [];
              return (
                <div key={iso} className={`group relative flex min-h-[104px] flex-col gap-1 bg-surface p-1.5 ${inMonth ? "" : "bg-bg-sunk/40"}`}>
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-semibold ${
                        isToday ? "bg-accent text-white" : inMonth ? "text-text" : "text-text-faint"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {canManage && inMonth && (
                      <button
                        type="button"
                        onClick={() => setCreatingOn(iso)}
                        className="hidden h-5 w-5 items-center justify-center rounded-md text-text-muted hover:bg-bg-sunk hover:text-accent group-hover:flex"
                        title="Add an event on this day"
                        aria-label={`Add an event on ${iso}`}
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {dayEvents.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setEditing(e)}
                        className={`truncate rounded-md border-l-2 ${STATUS_STYLE[e.status].border} ${STATUS_STYLE[e.status].bg} px-1.5 py-0.5 text-left text-[11px] font-semibold text-text-h hover:brightness-95`}
                        title={`${e.title}${formatTimeRange(e) ? ` · ${formatTimeRange(e)}` : ""}${e.model ? ` · ${e.model}` : ""} · ${e.status}`}
                      >
                        {formatTimeRange(e) && <span className="mr-1 font-normal text-text-muted">{e.start_time}</span>}
                        {e.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(editing || creatingOn) && (
        <CalendarEventModal
          event={editing}
          defaultDate={creatingOn ?? undefined}
          canManage={canManage}
          onClose={() => {
            setEditing(null);
            setCreatingOn(null);
          }}
          onSaved={() => {
            setEditing(null);
            setCreatingOn(null);
            load();
          }}
          onRequestDelete={(e) => {
            setEditing(null);
            setDeleting(e);
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete event"
          message={`Delete "${deleting.title}" on ${deleting.event_date}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          isConfirming={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
};

export default CalendarPage;
