import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** TEMPORARY diagnostic route -- isolates whether pdfkit itself runs on this Vercel deployment at all,
 * separate from anything specific to the audit-log export's table rendering. Delete once the audit-log
 * PDF export is confirmed working in production; not linked from anywhere in the app. */
export async function GET() {
  try {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
    doc.text("smoke test ok");
    doc.end();
    const pdf = await done;
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), stack: e instanceof Error ? e.stack : null }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
