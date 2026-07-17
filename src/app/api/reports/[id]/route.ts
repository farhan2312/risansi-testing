import { eq } from "drizzle-orm";

import { error, json, pointToDict, reportToDict } from "@/lib/api";
import { db } from "@/lib/db";
import { pumpTestReportPoints, pumpTestReports } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [report] = await db.select().from(pumpTestReports).where(eq(pumpTestReports.id, id)).limit(1);
  if (!report) {
    return error("Report not found", 404);
  }

  const points = await db.select().from(pumpTestReportPoints).where(eq(pumpTestReportPoints.reportId, id));

  return json({ ...reportToDict(report), points: points.map(pointToDict) });
}
