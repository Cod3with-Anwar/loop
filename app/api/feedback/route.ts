import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/auth";
import { classifyFeedback, embedText } from "@/src/lib/ai";

export async function GET(request: NextRequest) {
  const auth = await requireRole(["ADMIN", "ANALYST", "VIEWER"]);
  if (auth.response) return auth.response;
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") || 20) || 20));
  const from = params.get("from"); const to = params.get("to");
  const where = {
    workspaceId: auth.user.workspaceId,
    ...(params.get("q") ? { content: { contains: params.get("q")!, mode: "insensitive" as const } } : {}),
    ...(params.get("channel") ? { channel: params.get("channel")! } : {}),
    ...(params.get("status") && ["NEW", "REVIEWED", "ACTIONED"].includes(params.get("status")!) ? { status: params.get("status") as "NEW" | "REVIEWED" | "ACTIONED" } : {}),
    ...(params.get("sentiment") && ["POS", "NEU", "NEG"].includes(params.get("sentiment")!) ? { sentiment: params.get("sentiment") as "POS" | "NEU" | "NEG" } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    ...(params.get("theme") ? { themes: { some: { theme: { id: params.get("theme")!, workspaceId: auth.user.workspaceId } } } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.feedback.findMany({ where, include: { themes: { include: { theme: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.feedback.count({ where }),
  ]);
  return NextResponse.json({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(["ADMIN", "ANALYST"]);
  if (auth.response) return auth.response;
  let input: { content?: string; channel?: string; sourceRef?: string; customerLabel?: string };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const content = input.content?.trim(); const channel = input.channel?.trim();
  if (!content || content.length > 10000 || !channel || channel.length > 80) return NextResponse.json({ error: "Content (1-10000 chars) and channel are required." }, { status: 400 });
  try {
    const themes = await prisma.theme.findMany({ where: { workspaceId: auth.user.workspaceId }, select: { id: true, name: true } });
    const [classification, vector] = await Promise.all([classifyFeedback(content, themes.map((theme) => theme.name)).catch(() => null), embedText(content).catch(() => null)]);
    const item = await prisma.feedback.create({ data: {
      content, channel, sourceRef: input.sourceRef?.slice(0, 200), customerLabel: input.customerLabel?.slice(0, 200),
      workspaceId: auth.user.workspaceId,
      ...(vector ? { embedding: { create: { vector } } } : {}),
      ...(classification ? { sentiment: classification.sentiment, sentimentScore: classification.sentimentScore, featureArea: classification.featureArea, rationale: classification.rationale } : {}),
      ...(classification ? { themes: { create: classification.themes.filter((name) => typeof name === "string" && name.trim()).slice(0, 5).map((rawName) => { const name = rawName.trim().slice(0, 80); return { confidence: 0.7, theme: { connectOrCreate: { where: { workspaceId_name: { workspaceId: auth.user.workspaceId, name } }, create: { name, workspaceId: auth.user.workspaceId } } } }; }) } } : {}),
    }, include: { themes: { include: { theme: true } } } });
    return NextResponse.json({ item, classified: Boolean(classification) }, { status: 201 });
  } catch (error) {
    console.error("Feedback create failed", error);
    return NextResponse.json({ error: "Could not save feedback." }, { status: 500 });
  }
}
