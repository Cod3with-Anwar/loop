import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/auth";
import { classifyFeedback } from "@/src/lib/ai";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireRole(["ADMIN", "ANALYST"]);
  if (auth.response) return auth.response;
  let body: { status?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.status || !["NEW", "REVIEWED", "ACTIONED"].includes(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const { id } = await context.params;
  const result = await prisma.feedback.updateMany({ where: { id, workspaceId: auth.user.workspaceId }, data: { status: body.status as "NEW" | "REVIEWED" | "ACTIONED" } });
  if (!result.count) return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await requireRole(["ADMIN", "ANALYST"]);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const item = await prisma.feedback.findFirst({ where: { id, workspaceId: auth.user.workspaceId } });
  if (!item) return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  const themes = await prisma.theme.findMany({ where: { workspaceId: auth.user.workspaceId }, select: { name: true } });
  let classification;
  try { classification = await classifyFeedback(item.content, themes.map((theme) => theme.name)); }
  catch { return NextResponse.json({ error: "Classification failed. Check the AI provider configuration and try again." }, { status: 502 }); }
  if (!classification) return NextResponse.json({ error: "Reclassification needs ANTHROPIC_API_KEY configured." }, { status: 503 });
  await prisma.$transaction(async (tx) => {
    await tx.feedbackTheme.deleteMany({ where: { feedbackId: item.id } });
    await tx.feedback.update({ where: { id: item.id }, data: { sentiment: classification.sentiment, sentimentScore: classification.sentimentScore, featureArea: classification.featureArea, rationale: classification.rationale } });
    for (const rawName of classification.themes.filter((name) => typeof name === "string").slice(0, 5)) {
      const name = rawName.trim().slice(0, 80); if (!name) continue;
      const theme = await tx.theme.upsert({ where: { workspaceId_name: { workspaceId: auth.user.workspaceId, name } }, update: {}, create: { name, workspaceId: auth.user.workspaceId } });
      await tx.feedbackTheme.create({ data: { feedbackId: item.id, themeId: theme.id, confidence: 0.7 } });
    }
  });
  return NextResponse.json({ success: true });
}
