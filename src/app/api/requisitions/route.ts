import { desc, eq } from "drizzle-orm";

import { error, json, requisitionToDict } from "@/lib/api";
import { db } from "@/lib/db";
import { testRequisitions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const CAMEL_BY_SNAKE = {
  model: "model",
  category: "category",
  ec_quotation_no: "ecQuotationNo",
  responsible_person: "responsiblePerson",
  source_team: "sourceTeam",
  date_of_receipt: "dateOfReceipt",
  test_qty: "testQty",
  qth: "qth",
  power_hp: "powerHp",
  power_kw: "powerKw",
  head_kgcm2: "headKgcm2",
  rpm: "rpm",
  req_capacity: "reqCapacity",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const rows = status
    ? await db.select().from(testRequisitions).where(eq(testRequisitions.status, status)).orderBy(desc(testRequisitions.createdAt))
    : await db.select().from(testRequisitions).orderBy(desc(testRequisitions.createdAt));

  return json(rows.map(requisitionToDict));
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  if (!body.model) {
    return error("'model' is required", 400);
  }

  const values: Record<string, unknown> = {};
  for (const [snakeKey, camelKey] of Object.entries(CAMEL_BY_SNAKE)) {
    if (body[snakeKey] !== undefined && body[snakeKey] !== "") {
      values[camelKey] = body[snakeKey];
    }
  }

  const [requisition] = await db
    .insert(testRequisitions)
    .values({ ...values, status: "Pending" } as typeof testRequisitions.$inferInsert)
    .returning();

  return json(requisitionToDict(requisition), 201);
}
