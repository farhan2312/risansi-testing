import { eq } from "drizzle-orm";

import { error, json, userToDict } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { testRequisitions, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  let claims;
  try {
    claims = requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { userId } = await params;
  if (!UUID_RE.test(userId)) {
    return error("Invalid user id", 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  if (body.role !== undefined) {
    const newRole = body.role;
    if (newRole !== "source" && newRole !== "testing" && newRole !== "central-admin" && newRole !== "admin") {
      return error("'role' must be 'source', 'testing', 'central-admin', or 'admin'", 400);
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return error("User not found", 404);
    }

    const [updated] = await db
      .update(users)
      .set({ role: newRole })
      .where(eq(users.id, user.id))
      .returning();

    await logAudit({
      userId: claims.sub,
      userEmail: claims.email,
      eventType: "update",
      entityType: "user",
      entityId: updated.id,
      entityLabel: updated.email,
      details: `Role changed from ${user.role} to ${newRole}`,
    });

    return json(userToDict(updated));
  }

  const newStatus = body.status;
  if (newStatus !== "active" && newStatus !== "rejected") {
    return error("'status' or 'role' is required", 400);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return error("User not found", 404);
  }
  if (user.status !== "pending") {
    return error("This request has already been reviewed.", 409);
  }

  const [updated] = await db
    .update(users)
    .set({ status: newStatus, reviewedBy: claims.sub, reviewedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  await logAudit({
    userId: claims.sub,
    userEmail: claims.email,
    eventType: "update",
    entityType: "user",
    entityId: updated.id,
    entityLabel: updated.email,
    details: `Access request ${newStatus}`,
  });

  return json(userToDict(updated));
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  let claims;
  try {
    claims = requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { userId } = await params;
  if (!UUID_RE.test(userId)) {
    return error("Invalid user id", 400);
  }
  if (userId === claims.sub) {
    return error("You cannot delete your own account.", 400);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return error("User not found", 404);
  }

  // test_requisitions.created_by and users.reviewed_by both have a foreign
  // key to users.id at the DB level (not modeled in schema.ts, since this
  // app doesn't own that constraint) -- deleting a user who's ever raised a
  // requisition or reviewed an access request would otherwise fail with a
  // FK violation. Clear those references first; the human-readable trail
  // survives independently (test_requisitions.submitted_by is a separate
  // name snapshot, and status/reviewed_at stay on the reviewed account).
  await db.transaction(async (tx) => {
    await tx
      .update(testRequisitions)
      .set({ createdBy: null })
      .where(eq(testRequisitions.createdBy, userId));
    await tx.update(users).set({ reviewedBy: null }).where(eq(users.reviewedBy, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });

  await logAudit({
    userId: claims.sub,
    userEmail: claims.email,
    eventType: "delete",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.email,
  });

  return json({ success: true });
}
