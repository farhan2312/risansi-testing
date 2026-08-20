import { desc, eq } from "drizzle-orm";

import { bugReportToDict, error, json } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { AuthError, decodeToken, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bugReports, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB -- see schema.ts comment on bugReports.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const TYPES = new Set(["bug", "feature"]);
const SEVERITIES = new Set(["Low", "Medium", "High", "Critical"]);

/** Every logged-in user can report a bug regardless of role -- admin view is
 * gated separately, on GET. */
export async function GET(req: Request) {
  try {
    requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const rows = status
    ? await db.select().from(bugReports).where(eq(bugReports.status, status)).orderBy(desc(bugReports.createdAt))
    : await db.select().from(bugReports).orderBy(desc(bugReports.createdAt));

  return json(rows.map(bugReportToDict));
}

export async function POST(req: Request) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error("Request must be multipart/form-data", 400);
  }

  const title = String(form.get("title") ?? "").trim();
  if (!title) return error("'title' is required", 400);

  const typeRaw = String(form.get("type") ?? "bug");
  const type = TYPES.has(typeRaw) ? typeRaw : "bug";
  const severityRaw = String(form.get("severity") ?? "Medium");
  const severity = SEVERITIES.has(severityRaw) ? severityRaw : "Medium";
  const description = form.get("description") ? String(form.get("description")) : null;
  const page = form.get("page") ? String(form.get("page")).slice(0, 255) : null;

  const file = form.get("screenshot");
  let screenshotFileName: string | null = null;
  let screenshotMimeType: string | null = null;
  let screenshotFileSize: number | null = null;
  let screenshotData: Buffer | null = null;

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return error("Screenshot must be an image (JPEG/PNG/WEBP/GIF).", 400);
    }
    if (file.size > MAX_FILE_BYTES) {
      return error("Screenshot exceeds the 4MB limit.", 400);
    }
    screenshotFileName = file.name || "screenshot";
    screenshotMimeType = file.type;
    screenshotFileSize = file.size;
    screenshotData = Buffer.from(await file.arrayBuffer());
  }

  const [reporter] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);
  const reportedByName = reporter?.name ?? claims.email;

  const [report] = await db
    .insert(bugReports)
    .values({
      type,
      title,
      description,
      severity,
      page,
      screenshotFileName,
      screenshotMimeType,
      screenshotFileSize,
      screenshotData,
      reportedBy: claims.sub,
      reportedByName,
    })
    .returning();

  await logAudit({
    userId: claims.sub,
    userName: reportedByName,
    userEmail: claims.email,
    eventType: "create",
    entityType: "bug_report",
    entityId: report.id,
    entityLabel: report.title,
  });

  return json(bugReportToDict(report), 201);
}
