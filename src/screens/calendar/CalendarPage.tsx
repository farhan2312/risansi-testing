"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonPage } from "@/components/ui/Skeleton";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import { listCalendarEvents, deleteCalendarEvent } from "@/services/calendarService";
import { localIsoDay } from "@/lib/dateRangePresets";
import type { CalendarEvent } from "@/types/testing";
import CalendarEventModal from "./CalendarEventModal";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Every calendar date cell the grid needs to cover a full month, Monday-first (same week convention
 * dateRangePresets.ts uses), including the tail end of the previous/next month so every row has 7 days. */
const gridDays = (year: number, month: number): Date[] => {
  const first = new Date(year, month, 1);
  // getDay(): 0 = Sunday .. 6 = Saturday -> how many days back to the Monday on/before the 1st.
  const back = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - back);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
};

const formatTimeRange = (e: CalendarEvent) => {
  if (!e.start_time) return null;
  return e.end_time ? `${e.start_time} – ${e.end_time}` : e.start_time;
};

const CalendarPage = () => {
  const { user } = useAuth();
  const canManage = user?.role === "testing";

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [creatingOn, setCreatingOn] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const days = useMemo(() => gridDays(cursor.getFullYear(), cursor.getMonth()), [cursor]);
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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) map.set(e.event_date, [...(map.get(e.event_date) ?? []), e]);
    return map;
  }, [events]);

  const todayIso = localIsoDay(today);
  const monthIndex = cursor.getMonth();

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

  return (
    <div className="tw-reset mx-auto flex max-w-[1400px] flex-col gap-4 p-2">
      <PageHeader
        icon="📅"
        title="Testing Calendar"
        subtitle={canManage ? "Pump-testing events · you can add, edit and delete these" : "Pump-testing events · view-only (the testing team maintains this calendar)"}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="hero-btn hero-btn--secondary"
              aria-label="Previous month"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="hero-btn hero-btn--secondary"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="hero-btn hero-btn--secondary"
              aria-label="Next month"
            >
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

      <div className="viz-root rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="m-0 mb-3 text-lg font-bold text-text-h">
          {MONTH_NAMES[monthIndex]} {cursor.getFullYear()}
        </h2>

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
              <div
                key={iso}
                className={`group relative flex min-h-[104px] flex-col gap-1 bg-surface p-1.5 ${inMonth ? "" : "bg-bg-sunk/40"}`}
              >
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
                      className="truncate rounded-md bg-accent-soft px-1.5 py-0.5 text-left text-[11px] font-semibold text-accent-ink hover:brightness-95"
                      title={`${e.title}${formatTimeRange(e) ? ` · ${formatTimeRange(e)}` : ""}${e.model ? ` · ${e.model}` : ""}`}
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
