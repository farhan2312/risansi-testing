import { desc } from "drizzle-orm";

import { actionRegistryToDict, error, json } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionRegistry } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Every "Assign Retest" ever raised, newest first -- Admin / Central Admin
 * only, same gate as assigning one in the first place. */
export async function GET(req: Request) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }
  if (claims.role !== "admin" && claims.role !== "central-admin") {
    return error("Only Admin or Central Admin can view the Action Registry.", 403);
  }

  const rows = await db.select().from(actionRegistry).orderBy(desc(actionRegistry.createdAt));
  return json(rows.map(actionRegistryToDict));
}
