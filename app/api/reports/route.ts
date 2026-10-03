import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/auth";
import { writeReport } from "@/src/lib/ai";

export async function GET() {
  const auth = await requireRole(["ADMIN", "ANALYST", "VIEWER"]);
  if (auth.response) return auth.response;
  const reports = await prisma.report.findMany({ where: { workspaceId: auth.user.workspaceId }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json(reports);
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(["ADMIN", "ANALYST"]);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const end = body.end ? new Date(body.end) : new Date(); const start = body.start ? new Date(body.start) : new Date(Date.now() - 7 * 86400000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return NextResponse.json({ error: "Invalid report date range." }, { status: 400 });
  const items = await prisma.feedback.findMany({ where: { workspaceId: auth.user.workspaceId, createdAt: { gte: start, lte: end } }, include: { themes: { include: { theme: true } } }, orderBy: { createdAt: "desc" }, take: 5000 });
  const themeCounts = new Map<string, number>(); const sentiment = { POS: 0, NEU: 0, NEG: 0 };
  for (const item of items) { if (item.sentiment) sentiment[item.sentiment]++; for (const tag of item.themes) themeCounts.set(tag.theme.name, (themeCounts.get(tag.theme.name) || 0) + 1); }
  const facts = { total: items.length, sentiment, topThemes: Array.from(themeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })), quotes: items.slice(0, 5).map((item) => item.content) };
  let narrative: { summary: string; actions: string[] } = { summary: `This period includes ${items.length} feedback items.`, actions: [] };
  try { const generated = await writeReport(facts); if (generated) { const parsed = JSON.parse(generated.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); if (typeof parsed.summary === "string" && Array.isArray(parsed.actions)) narrative = { summary: parsed.summary, actions: parsed.actions.filter((item: unknown) => typeof item === "string") }; } } catch (error) { console.error("Report narrative failed", error); }
  const report = await prisma.report.create({ data: { title: `Voice of Customer: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`, periodStart: start, periodEnd: end, contentJson: { facts, narrative }, workspaceId: auth.user.workspaceId, generatedById: auth.user.id } });
  return NextResponse.json(report, { status: 201 });
}
