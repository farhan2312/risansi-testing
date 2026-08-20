import { sql } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { userSessions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** "Today" here means "trailing 24h", same as the summary tiles -- simplest
 * to reason about without dragging in the viewer's timezone for a calendar-
 * day boundary, and matches how every other 24h stat in this app works. */
function cutoffFor(range: string | null): Date | null {
  const now = Date.now();
  if (range === "today") return new Date(now - 24 * 60 * 60 * 1000);
  if (range === "30days") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  if (range === "all") return null;
  return new Date(now - 7 * 24 * 60 * 60 * 1000); // default / "7days"
}

/** Per-user rollup for the "Usage & Time" tab: sessions, active time, pages
 * visited, last active -- within the given range. */
export async function GET(req: Request) {
  try {
    requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const cutoff = cutoffFor(searchParams.get("range"));

  const rows = await db
    .select({
      userId: userSessions.userId,
      userName: sql<string | null>`max(${userSessions.userName})`,
      userEmail: sql<string | null>`max(${userSessions.userEmail})`,
      sessionCount: sql<number>`count(*)::int`,
      activeSeconds: sql<number>`coalesce(sum(extract(epoch from (coalesce(${userSessions.logoutAt}, ${userSessions.lastSeenAt}) - ${userSessions.loginAt}))), 0)::float`,
      pageCount: sql<number>`coalesce(sum(${userSessions.pageViewCount}), 0)::int`,
      lastActive: sql<string>`max(${userSessions.lastSeenAt})`,
    })
    .from(userSessions)
    .where(cutoff ? sql`${userSessions.loginAt} > ${cutoff}` : sql`true`)
    .groupBy(userSessions.userId)
    .orderBy(sql`4 desc`); // activeSeconds

  return json(
    rows.map((r) => ({
      user_id: r.userId,
      user_name: r.userName,
      user_email: r.userEmail,
      session_count: r.sessionCount,
      active_seconds: Math.round(r.activeSeconds),
      page_count: r.pageCount,
      last_active: r.lastActive,
    }))
  );
}
