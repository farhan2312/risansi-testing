import { and, desc, eq, inArray } from "drizzle-orm";

import { error, json, requisitionToDict } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { pumpTestReports, testRequisitions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const CAMEL_BY_SNAKE = {
  model: "model",
  category: "category",
  ec_quotation_no: "ecQuotationNo",
  offer_date: "offerDate",
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
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const conditions = [];
  if (status) conditions.push(eq(testRequisitions.status, status));
  // Source teams only see the requisitions they personally raised — testing
  // team and admins still see everything, since they process all of them.
  if (claims.role === "source") conditions.push(eq(testRequisitions.createdBy, claims.sub));

  const rows = conditions.length
    ? await db.select().from(testRequisitions).where(and(...conditions)).orderBy(desc(testRequisitions.createdAt))
    : await db.select().from(testRequisitions).orderBy(desc(testRequisitions.createdAt));

  const requisitionIds = rows.map((r) => r.id);
  const reports = requisitionIds.length
    ? await db
        .select({ id: pumpTestReports.id, requisitionId: pumpTestReports.requisitionId })
        .from(pumpTestReports)
        .where(inArray(pumpTestReports.requisitionId, requisitionIds))
    : [];
  const reportIdByRequisition = new Map(reports.map((r) => [r.requisitionId, r.id]));

  return json(
    rows.map((r) => ({ ...requisitionToDict(r), report_id: reportIdByRequisition.get(r.id) ?? null }))
  );
}

export async function POST(req: Request) {
  let claims;
  try {
    claims = decodeToken(req);
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
    .values({ ...values, status: "Pending", createdBy: claims.sub } as typeof testRequisitions.$inferInsert)
    .returning();

  return json(requisitionToDict(requisition), 201);
}
