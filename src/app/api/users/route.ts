import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";

import { error, json, userToDict } from "@/lib/api";
import { getClientIp, logAudit } from "@/lib/audit";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const ROLES = ["source", "testing", "central-admin", "admin"];

export async function GET(req: Request) {
  try {
    requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const status = new URL(req.url).searchParams.get("status");
  const rows = status
    ? await db.select().from(users).where(eq(users.status, status)).orderBy(asc(users.createdAt))
    : await db.select().from(users).orderBy(asc(users.createdAt));

  return json(rows.map(userToDict));
}

/** Admin-only direct account creation -- unlike the public /access-requests
 * signup, this skips the pending-review step (the admin creating the
 * account *is* the approval) and can assign any role, including
 * central-admin/admin which aren't self-serviceable from the login screen. */
export async function POST(req: Request) {
  let claims;
  try {
    claims = requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = String(body.role ?? "");

  if (!name || !email || !password) {
    return error("'name', 'email', and 'password' are required", 400);
  }
  if (!ROLES.includes(role)) {
    return error(`'role' must be one of: ${ROLES.join(", ")}`, 400);
  }
  if (password.length < 6) {
    return error("Password must be at least 6 characters.", 400);
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return error("An account with this email already exists.", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      role,
      status: "active",
      reviewedBy: claims.sub,
      reviewedAt: new Date(),
      mustChangePassword: true,
    })
    .returning();

  await logAudit({
    ipAddress: getClientIp(req),
    userId: claims.sub,
    userEmail: claims.email,
    eventType: "create",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.email,
    details: `Created directly by admin with role ${role}`,
  });

  return json(userToDict(user), 201);
}
