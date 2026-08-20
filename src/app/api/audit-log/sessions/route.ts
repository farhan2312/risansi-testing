import { and, desc, gt, inArray } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function cutoffFor(range: string | null): Date | null {
  const now = Date.now();
  if (range === "today") return new Date(now - 24 * 60 * 60 * 1000);
  if (range === "30days") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  if (range === "all") return null;
  return new Date(now - 7 * 24 * 60 * 60 * 1000);
}

/** Raw login / login_failed / logout event list for the "Logins & Sessions" tab. */
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

  const conditions = [inArray(auditLogs.eventType, ["login", "login_failed", "logout"])];
  if (cutoff) conditions.push(gt(auditLogs.createdAt, cutoff));

  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return json(
    rows.map((r) => ({
      id: r.id,
      user_name: r.userName,
      user_email: r.userEmail,
      event_type: r.eventType,
      details: r.details,
      created_at: r.createdAt,
    }))
  );
}
