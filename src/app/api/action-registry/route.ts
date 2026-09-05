import { desc, inArray } from "drizzle-orm";

import { actionRegistryToDict, error, json } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionRegistry, testRequisitions } from "@/lib/db/schema";

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

  // "View requisition" links to the pretty number, not the raw uuid these
  // rows store -- one batched lookup for every requisition referenced here.
  const requisitionIds = [...new Set(rows.map((r) => r.requisitionId))];
  const requisitionNoById = new Map(
    requisitionIds.length
      ? (
          await db
            .select({ id: testRequisitions.id, requisitionNo: testRequisitions.requisitionNo })
            .from(testRequisitions)
            .where(inArray(testRequisitions.id, requisitionIds))
        ).map((r) => [r.id, r.requisitionNo])
      : []
  );

  return json(
    rows.map((r) => ({
      ...actionRegistryToDict(r),
      requisition_no: requisitionNoById.get(r.requisitionId) ?? null,
    }))
  );
}
