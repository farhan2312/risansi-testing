import apiClient from "./apiClient";
import type { CalendarEvent, NewCalendarEventInput } from "../types/testing";

/** Every event in range (inclusive) -- omit both for everything. Everyone signed in can call this;
 * only the Testing role can create/update/delete (see the create/update/delete calls below). */
export const listCalendarEvents = async (range?: { from?: string; to?: string }): Promise<CalendarEvent[]> => {
  const { data } = await apiClient.get<CalendarEvent[]>("/calendar-events", { params: range });
  return data;
};

export const createCalendarEvent = async (input: NewCalendarEventInput): Promise<CalendarEvent> => {
  const { data } = await apiClient.post<CalendarEvent>("/calendar-events", input);
  return data;
};

export const updateCalendarEvent = async (id: string, patch: Partial<NewCalendarEventInput>): Promise<CalendarEvent> => {
  const { data } = await apiClient.patch<CalendarEvent>(`/calendar-events/${id}`, patch);
  return data;
};

export const deleteCalendarEvent = async (id: string): Promise<void> => {
  await apiClient.delete(`/calendar-events/${id}`);
};
