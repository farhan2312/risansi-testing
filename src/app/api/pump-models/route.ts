import { asc } from "drizzle-orm";

import { json } from "@/lib/api";
import { db } from "@/lib/db";
import { pumpModels } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select({ model: pumpModels.model }).from(pumpModels).orderBy(asc(pumpModels.model));
  return json(rows.map((r) => r.model));
}
