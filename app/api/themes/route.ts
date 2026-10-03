import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/auth";

export async function GET() {
  const auth = await requireRole(["ADMIN", "ANALYST", "VIEWER"]);
  if (auth.response) return auth.response;
  const themes = await prisma.theme.findMany({ where: { workspaceId: auth.user.workspaceId }, include: { feedback: { where: { feedback: { workspaceId: auth.user.workspaceId } }, include: { feedback: { select: { id: true, content: true, createdAt: true, sentiment: true } } } }, _count: { select: { feedback: true } } }, orderBy: { name: "asc" } });
  const since = new Date(Date.now() - 14 * 86400000);
  return NextResponse.json(themes.map((theme) => ({ id: theme.id, name: theme.name, description: theme.description, color: theme.color, count: theme._count.feedback, recentCount: theme.feedback.filter((entry) => entry.feedback.createdAt >= since).length, items: theme.feedback.map((entry) => entry.feedback) })));
}
