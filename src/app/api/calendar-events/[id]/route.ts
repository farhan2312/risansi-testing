import { eq } from "drizzle-orm";

import { calendarEventToDict, error, json } from "@/lib/api";
import { getClientIp, logAudit } from "@/lib/audit";
import { AuthError, decodeToken } from "@/lib/auth";
import { canManageCalendar } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { calendarEvents } from "@/lib/db/schema";
import { CALENDAR_EVENT_STATUSES, RESPONSIBLE_PERSONS } from "@/types/testing";

export const dynamic = "force-dynamic";

const FIELD_MAP: Record<string, string> = {
  title: "title",
  model: "model",
  ec_quotation_no: "ecQuotationNo",
  responsible_person: "responsiblePerson",
  status: "status",
  event_date: "eventDate",
  start_time: "startTime",
  end_time: "endTime",
  notes: "notes",
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let claims;
  try {
    claims = await decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }
  if (!canManageCalendar(claims.role)) {
    return error("Only an admin or the testing team can update calendar events.", 403);
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  if (body.event_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.event_date))) {
    return error("'event_date' must be a YYYY-MM-DD date", 400);
  }
  if (body.title !== undefined && !String(body.title).trim()) {
    return error("'title' cannot be blank", 400);
  }
  if (body.responsible_person !== undefined && !RESPONSIBLE_PERSONS.includes(String(body.responsible_person).trim() as (typeof RESPONSIBLE_PERSONS)[number])) {
    return error(`'responsible_person' must be one of: ${RESPONSIBLE_PERSONS.join(", ")}`, 400);
  }
  if (body.status !== undefined && !CALENDAR_EVENT_STATUSES.includes(body.status as never)) {
    return error(`'status' must be one of: ${CALENDAR_EVENT_STATUSES.join(", ")}`, 400);
  }

  const values: Record<string, unknown> = {};
  for (const [snakeKey, camelKey] of Object.entries(FIELD_MAP)) {
    if (body[snakeKey] === undefined) continue;
    const v = body[snakeKey];
    // "" clears an optional field (model/start_time/end_time/notes) to NULL, same convention as the
    // requisition PATCH route -- title/event_date are validated above and never blank here.
    values[camelKey] = typeof v === "string" && v.trim() === "" && snakeKey !== "title" && snakeKey !== "event_date" ? null : typeof v === "string" ? v.trim() : v;
  }
  values.updatedAt = new Date();

  const [updated] = await db.update(calendarEvents).set(values).where(eq(calendarEvents.id, id)).returning();
  if (!updated) return error("Calendar event not found", 404);

  await logAudit({
    ipAddress: getClientIp(req),
    userId: claims.sub,
    userEmail: claims.email,
    eventType: "update",
    entityType: "calendar_event",
    entityId: updated.id,
    entityLabel: updated.title,
    details: `Changed: ${Object.keys(values).filter((k) => k !== "updatedAt").join(", ") || "nothing"}`,
  });

  return json(calendarEventToDict(updated));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let claims;
  try {
    claims = await decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }
  if (!canManageCalendar(claims.role)) {
    return error("Only an admin or the testing team can delete calendar events.", 403);
  }

  const { id } = await params;
  const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).limit(1);
  if (!existing) return error("Calendar event not found", 404);

  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));

  await logAudit({
    ipAddress: getClientIp(req),
    userId: claims.sub,
    userEmail: claims.email,
    eventType: "delete",
    entityType: "calendar_event",
    entityId: existing.id,
    entityLabel: existing.title,
    details: `${existing.eventDate}${existing.model ? ` · ${existing.model}` : ""}`,
  });

  return json({ ok: true });
}
