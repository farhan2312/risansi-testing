"use client";

import { useEffect, useState } from "react";
import { createCalendarEvent, updateCalendarEvent } from "@/services/calendarService";
import { listPumpModels } from "@/services/testingService";
import type { CalendarEvent } from "@/types/testing";

interface CalendarEventModalProps {
  /** Editing this event, or null when creating a new one. */
  event: CalendarEvent | null;
  /** Pre-fills the date field when creating (the day the user clicked "+" on). */
  defaultDate?: string;
  /** false = every field is read-only, Close is the only action (a non-Testing viewer). */
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
  onRequestDelete: (event: CalendarEvent) => void;
}

const errorMessage = (err: unknown, fallback: string): string => {
  const response = (err as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error ?? fallback;
};

const inputClasses =
  "h-11 w-full rounded-lg border border-border bg-bg-app px-3.5 text-[15px] text-text-h outline-none focus:border-accent focus:ring-2 focus:ring-accent-line disabled:cursor-not-allowed disabled:opacity-70";
const labelClasses = "mt-3.5 mb-1.5 block text-[13px] font-semibold text-text";

/** Create/edit/view for one Testing Calendar event. Only the Testing role (canManage) gets editable
 * fields and Save/Delete -- everyone else sees the same layout read-only, since the calendar itself is
 * visible to the whole portal even though only Testing maintains it. */
const CalendarEventModal = ({ event, defaultDate, canManage, onClose, onSaved, onRequestDelete }: CalendarEventModalProps) => {
  const [title, setTitle] = useState(event?.title ?? "");
  const [model, setModel] = useState(event?.model ?? "");
  const [eventDate, setEventDate] = useState(event?.event_date ?? defaultDate ?? "");
  const [startTime, setStartTime] = useState(event?.start_time ?? "");
  const [endTime, setEndTime] = useState(event?.end_time ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");

  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    listPumpModels()
      .then(setModelOptions)
      .catch(() => {});
  }, [canManage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!eventDate) {
      setFormError("Date is required.");
      return;
    }
    setFormError("");
    setIsSubmitting(true);
    try {
      const payload = { title: title.trim(), event_date: eventDate, model, start_time: startTime, end_time: endTime, notes };
      if (event) await updateCalendarEvent(event.id, payload);
      else await createCalendarEvent(payload);
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err, event ? "Could not update the event." : "Could not create the event."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[440px] max-w-[92vw] rounded-2xl bg-surface p-6 pb-6.5 text-text shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-event-title"
      >
        <div className="mb-4.5 flex items-center justify-between">
          <h3 id="calendar-event-title" className="m-0 text-xl text-text-h">
            {canManage ? (event ? "Edit Event" : "New Event") : "Event Details"}
          </h3>
          <button type="button" className="border-none bg-none text-base text-text-muted" onClick={onClose} aria-label="Close">
            &#10005;
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="mb-1.5 rounded-md border border-neg bg-neg-soft px-3.5 py-2.5 text-[13px] text-neg-strong" role="alert">
              {formError}
            </div>
          )}

          <label htmlFor="cal-event-title" className={labelClasses}>
            Title
          </label>
          <input id="cal-event-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage} className={inputClasses} placeholder="e.g. H40 retest, panel calibration" />

          <label htmlFor="cal-event-model" className={labelClasses}>
            Model (optional)
          </label>
          <input
            id="cal-event-model"
            type="text"
            list="cal-event-model-options"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={!canManage}
            className={inputClasses}
            placeholder="Which pump this is about, if any"
          />
          <datalist id="cal-event-model-options">
            {modelOptions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>

          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="cal-event-date" className={labelClasses}>
                Date
              </label>
              <input id="cal-event-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} disabled={!canManage} className={inputClasses} />
            </div>
            <div className="flex-1">
              <label htmlFor="cal-event-start" className={labelClasses}>
                Start (optional)
              </label>
              <input id="cal-event-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!canManage} className={inputClasses} />
            </div>
            <div className="flex-1">
              <label htmlFor="cal-event-end" className={labelClasses}>
                End (optional)
              </label>
              <input id="cal-event-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!canManage} className={inputClasses} />
            </div>
          </div>

          <label htmlFor="cal-event-notes" className={labelClasses}>
            Notes (optional)
          </label>
          <textarea
            id="cal-event-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canManage}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-bg-app px-3.5 py-2.5 text-[15px] text-text-h outline-none focus:border-accent focus:ring-2 focus:ring-accent-line disabled:cursor-not-allowed disabled:opacity-70"
          />

          {event && (
            <p className="mt-3 text-[12px] text-text-faint">
              Added by {event.created_by_name}
              {event.updated_at !== event.created_at ? " · edited since" : ""}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between gap-2">
            <div>
              {canManage && event && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(event)}
                  className="rounded-lg border border-neg/30 bg-neg-soft px-3.5 py-2 text-[13px] font-semibold text-neg-strong hover:border-neg hover:bg-neg hover:text-white"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-text hover:bg-surface-hover">
                {canManage ? "Cancel" : "Close"}
              </button>
              {canManage && (
                <button type="submit" disabled={isSubmitting} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:brightness-95 disabled:opacity-60">
                  {isSubmitting ? "Saving…" : event ? "Save Changes" : "Create Event"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CalendarEventModal;
