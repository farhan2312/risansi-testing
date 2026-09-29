/** Who may create/update/delete a Testing Calendar event -- shared by the API routes and the
 * calendar screen, so the UI never offers something the server will refuse. Everyone signed in can
 * view the calendar; only Admin can manage it (see calendarEvents in schema.ts). */
export const canManageCalendar = (role: string | undefined): boolean => role === "admin";
