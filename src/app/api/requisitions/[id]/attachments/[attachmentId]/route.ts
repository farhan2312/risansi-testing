import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { error } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { requisitionAttachments, testRequisitions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function canManageAttachments(role: string, createdBy: string | null, userId: string): boolean {
  if (role === "admin" || role === "central-admin") return true;
  if (role === "source") return createdBy === userId;
  return false;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { id, attachmentId } = await params;
  const [requisition] = await db.select().from(testRequisitions).where(eq(testRequisitions.id, id)).limit(1);
  if (!requisition) return error("Requisition not found", 404);
  if (claims.role === "source" && requisition.createdBy !== claims.sub) {
    return error("You can only view requisitions you raised.", 403);
  }

  const [attachment] = await db
    .select()
    .from(requisitionAttachments)
    .where(and(eq(requisitionAttachments.id, attachmentId), eq(requisitionAttachments.requisitionId, id)))
    .limit(1);
  if (!attachment) return error("Attachment not found", 404);

  // Buffer -> ArrayBuffer copy: NextResponse needs a BodyInit, and a Node
  // Buffer's underlying ArrayBuffer can be larger than the Buffer itself
  // (pooled allocations), so slice out exactly this attachment's bytes.
  const bytes = attachment.fileData;
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.fileSize),
      // Inline, not "attachment" -- the testing team opens PDFs/images in a
      // new tab rather than triggering a file-save prompt.
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { id, attachmentId } = await params;
  const [requisition] = await db.select().from(testRequisitions).where(eq(testRequisitions.id, id)).limit(1);
  if (!requisition) return error("Requisition not found", 404);
  if (!canManageAttachments(claims.role, requisition.createdBy, claims.sub)) {
    return error("You don't have permission to remove attachments from this testing summary.", 403);
  }

  const deleted = await db
    .delete(requisitionAttachments)
    .where(and(eq(requisitionAttachments.id, attachmentId), eq(requisitionAttachments.requisitionId, id)))
    .returning({ id: requisitionAttachments.id });

  if (!deleted.length) return error("Attachment not found", 404);
  return NextResponse.json({ ok: true });
}
