/**
 * Shared helper for writing to audit_logs -- called from every route that
 * changes data (or logs in/out), never awaited in a way that can block or
 * fail the actual request; a logging hiccup should never break a real
 * action. See schema.ts for the table shape and the Audit Log admin page
 * for how these get read back.
 */
import { db } from "./db";
import { auditLogs } from "./db/schema";

export type AuditEventType = "login" | "login_failed" | "logout" | "create" | "update" | "delete";
export type AuditEntityType = "requisition" | "report" | "attachment" | "user" | "bug_report";

export interface AuditParams {
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  eventType: AuditEventType;
  entityType?: AuditEntityType | null;
  entityId?: string | null;
  entityLabel?: string | null;
  details?: string | null;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId ?? null,
      userName: params.userName ?? null,
      userEmail: params.userEmail ?? null,
      eventType: params.eventType,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      entityLabel: params.entityLabel ?? null,
      details: params.details ?? null,
    });
  } catch (err) {
    // Never let an audit-log write take down the real request it's
    // describing -- just surface it server-side for visibility.
    console.error("logAudit failed:", err);
  }
}
