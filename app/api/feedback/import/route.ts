import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/auth";

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(["ADMIN", "ANALYST"]);
  if (auth.response) return auth.response;
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || file.size > 2_000_000) return NextResponse.json({ error: "Upload a CSV file smaller than 2 MB." }, { status: 400 });
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return NextResponse.json({ imported: 0, failed: 0, errors: ["CSV has no data rows"] }, { status: 400 });
  const headers = rows.shift()!.map((h) => h.trim().toLowerCase());
  const contentIndex = headers.indexOf("content"); const channelIndex = headers.indexOf("channel");
  if (contentIndex < 0 || channelIndex < 0) return NextResponse.json({ error: "CSV needs content and channel columns." }, { status: 400 });
  const dateIndex = headers.indexOf("created_at"); const customerIndex = headers.indexOf("customer_label");
  const valid = rows.filter((r) => r[contentIndex]?.trim() && r[contentIndex].length <= 10000 && r[channelIndex]?.trim()).slice(0, 1000);
  const data = valid.map((r) => ({ content: r[contentIndex].trim(), channel: r[channelIndex].trim().slice(0, 80), customerLabel: customerIndex >= 0 ? r[customerIndex]?.slice(0, 200) : undefined, createdAt: dateIndex >= 0 && !Number.isNaN(Date.parse(r[dateIndex])) ? new Date(r[dateIndex]) : undefined, workspaceId: auth.user.workspaceId }));
  if (data.length) await prisma.feedback.createMany({ data });
  return NextResponse.json({ imported: data.length, failed: rows.length - data.length, capped: rows.length > 1000 });
}
