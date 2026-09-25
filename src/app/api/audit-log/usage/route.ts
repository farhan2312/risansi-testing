import { eq, sql } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { userSessions, users } from "@/lib/db/schema";
import { parseAuditWindow, windowCondition } from "@/lib/auditRange";

export const dynamic = "force-dynamic";

/** Per-user rollup for the "Usage & Time" tab: sessions, active time, pages
 * visited, last active -- within the given range. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const window = parseAuditWindow(searchParams);

  const rows = await db
    .select({
      userId: userSessions.userId,
      userName: sql<string | null>`max(${userSessions.userName})`,
      userEmail: sql<string | null>`max(${userSessions.userEmail})`,
      // Live role, not a snapshot -- null once the account is deleted, same
      // as every other "joined against users, may be gone" field in this app.
      userRole: sql<string | null>`max(${users.role})`,
      sessionCount: sql<number>`count(*)::int`,
      activeSeconds: sql<number>`coalesce(sum(extract(epoch from (coalesce(${userSessions.logoutAt}, ${userSessions.lastSeenAt}) - ${userSessions.loginAt}))), 0)::float`,
      pageCount: sql<number>`coalesce(sum(${userSessions.pageViewCount}), 0)::int`,
      lastActive: sql<string>`max(${userSessions.lastSeenAt})`,
    })
    .from(userSessions)
    .leftJoin(users, eq(users.id, userSessions.userId))
    .where(windowCondition(userSessions.loginAt, window))
    .groupBy(userSessions.userId)
    .orderBy(sql`6 desc`); // activeSeconds

  return json(
    rows.map((r) => ({
      user_id: r.userId,
      user_name: r.userName,
      user_email: r.userEmail,
      user_role: r.userRole,
      session_count: r.sessionCount,
      active_seconds: Math.round(r.activeSeconds),
      page_count: r.pageCount,
      last_active: r.lastActive,
    }))
  );
}
