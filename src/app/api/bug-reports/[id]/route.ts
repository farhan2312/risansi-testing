import { eq } from "drizzle-orm";

import { bugReportToDict, error, json } from "@/lib/api";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bugReports } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["Open", "In Progress", "Resolved"]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const status = typeof body.status === "string" ? body.status : undefined;
  if (status !== undefined && !STATUSES.has(status)) {
    return error("Invalid status", 400);
  }

  const [report] = await db
    .update(bugReports)
    .set(status !== undefined ? { status } : {})
    .where(eq(bugReports.id, id))
    .returning();

  if (!report) return error("Bug report not found", 404);
  return json(bugReportToDict(report));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { id } = await params;
  const deleted = await db.delete(bugReports).where(eq(bugReports.id, id)).returning({ id: bugReports.id });
  if (!deleted.length) return error("Bug report not found", 404);
  return json({ success: true });
}
