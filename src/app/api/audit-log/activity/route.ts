import { and, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, pumpTestReports, testRequisitions, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function cutoffFor(range: string | null): Date | null {
  const now = Date.now();
  if (range === "today") return new Date(now - 24 * 60 * 60 * 1000);
  if (range === "30days") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  if (range === "all") return null;
  return new Date(now - 7 * 24 * 60 * 60 * 1000);
}

const ACTION_TYPES = new Set(["create", "update", "delete"]);

/** Raw create / update / delete event list for the "Activity" tab -- every
 * data-changing action across requisitions, reports, attachments, users,
 * bug reports. Supports narrowing to one action type and a free-text search
 * across who/what/details, plus a total count so the UI can show
 * "N entries" even though the row list itself is capped. */
export async function GET(req: Request) {
  try {
    requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const cutoff = cutoffFor(searchParams.get("range"));
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 500);
  const action = searchParams.get("action");
  const search = searchParams.get("search")?.trim();

  const eventTypes = action && ACTION_TYPES.has(action) ? [action] : ["create", "update", "delete"];
  const conditions = [inArray(auditLogs.eventType, eventTypes)];
  if (cutoff) conditions.push(gt(auditLogs.createdAt, cutoff));
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      or(
        ilike(auditLogs.userEmail, like),
        ilike(auditLogs.userName, like),
        ilike(auditLogs.entityLabel, like),
        ilike(auditLogs.details, like)
      )!
    );
  }
  const where = and(...conditions);

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        userName: auditLogs.userName,
        userEmail: auditLogs.userEmail,
        userRole: users.role,
        eventType: auditLogs.eventType,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        entityLabel: auditLogs.entityLabel,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where),
  ]);

  // The "requisition"/"report" entity links should point at the pretty
  // number, not the raw uuid audit_logs stores -- one batched lookup per
  // entity type for whatever's actually referenced on this page of rows.
  const requisitionIds = rows.filter((r) => r.entityType === "requisition" && r.entityId).map((r) => r.entityId!);
  const reportIds = rows.filter((r) => r.entityType === "report" && r.entityId).map((r) => r.entityId!);
  const [requisitionNoRows, reportNoRows] = await Promise.all([
    requisitionIds.length
      ? db
          .select({ id: testRequisitions.id, requisitionNo: testRequisitions.requisitionNo })
          .from(testRequisitions)
          .where(inArray(testRequisitions.id, requisitionIds))
      : Promise.resolve([]),
    reportIds.length
      ? db
          .select({ id: pumpTestReports.id, reportNo: pumpTestReports.reportNo })
          .from(pumpTestReports)
          .where(inArray(pumpTestReports.id, reportIds))
      : Promise.resolve([]),
  ]);
  const requisitionNoById = new Map(requisitionNoRows.map((r) => [r.id, r.requisitionNo]));
  const reportNoById = new Map(reportNoRows.map((r) => [r.id, r.reportNo]));

  return json({
    entries: rows.map((r) => ({
      id: r.id,
      user_name: r.userName,
      user_email: r.userEmail,
      user_role: r.userRole,
      event_type: r.eventType,
      entity_type: r.entityType,
      entity_id: r.entityId,
      entity_no:
        r.entityType === "requisition"
          ? requisitionNoById.get(r.entityId ?? "") ?? null
          : r.entityType === "report"
            ? reportNoById.get(r.entityId ?? "") ?? null
            : null,
      entity_label: r.entityLabel,
      details: r.details,
      ip_address: r.ipAddress,
      created_at: r.createdAt,
    })),
    total: count,
  });
}
