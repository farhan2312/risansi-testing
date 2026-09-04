import { and, eq, gt, sql } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageViews } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function cutoffFor(range: string | null): Date | null {
  const now = Date.now();
  if (range === "today") return new Date(now - 24 * 60 * 60 * 1000);
  if (range === "30days") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  if (range === "all") return null;
  return new Date(now - 7 * 24 * 60 * 60 * 1000);
}

/** Which pages one user actually visited within a range, and how often --
 * the "click a user for the page breakdown" drill-down on Usage & Time.
 * Uses page_views directly (already captured for the Pages count), so no
 * schema change was needed for this. */
export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { userId } = await params;
  const { searchParams } = new URL(req.url);
  const cutoff = cutoffFor(searchParams.get("range"));

  const conditions = [eq(pageViews.userId, userId)];
  if (cutoff) conditions.push(gt(pageViews.viewedAt, cutoff));

  const rows = await db
    .select({
      path: pageViews.path,
      viewCount: sql<number>`count(*)::int`,
      lastViewed: sql<string>`max(${pageViews.viewedAt})`,
    })
    .from(pageViews)
    .where(and(...conditions))
    .groupBy(pageViews.path)
    .orderBy(sql`2 desc`); // viewCount

  return json(
    rows.map((r) => ({
      path: r.path,
      view_count: r.viewCount,
      last_viewed: r.lastViewed,
    }))
  );
}
