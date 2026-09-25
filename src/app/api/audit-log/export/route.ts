import { desc } from "drizzle-orm";

import { error } from "@/lib/api";
import { AuthError, requireAdmin } from "@/lib/auth";
import { parseAuditWindow, windowCondition } from "@/lib/auditRange";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Safety cap -- an all-time export of a busy log shouldn't be able to pull
 * the whole table into one response. */
const MAX_ROWS = 20_000;

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? "" : String(value);
  // Leading = + - @ would be read as a formula by Excel/Sheets -- the log
  // holds user-typed text (model names, remarks), so neutralise it.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const istStamp = (d: Date | null) =>
  d ? new Date(d.getTime() + 330 * 60_000).toISOString().replace("T", " ").slice(0, 19) : "";

/** "Generate Report" on the Audit Log page: the selected date range's events
 * as a CSV download, newest first. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const window = parseAuditWindow(new URL(req.url).searchParams);
  const rows = await db
    .select()
    .from(auditLogs)
    .where(windowCondition(auditLogs.createdAt, window))
    .orderBy(desc(auditLogs.createdAt))
    .limit(MAX_ROWS);

  const lines = [
    ["Time (IST)", "Event", "User", "Email", "Entity", "Label", "Details", "IP address"].join(","),
    ...rows.map((r) =>
      [istStamp(r.createdAt), r.eventType, r.userName, r.userEmail, r.entityType, r.entityLabel, r.details, r.ipAddress]
        .map(csvCell)
        .join(",")
    ),
  ];

  const label = `${window.fromDay ?? "start"}_to_${window.toDay ?? "today"}`;
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log_${label}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
