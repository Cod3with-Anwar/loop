import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/auth";
import { answerFromFeedback, embedText } from "@/src/lib/ai";

export async function POST(request: NextRequest) {
  const auth = await requireRole(["ADMIN", "ANALYST", "VIEWER"]);
  if (auth.response) return auth.response;
  const { question } = await request.json().catch(() => ({}));
  if (typeof question !== "string" || question.trim().length < 3 || question.length > 500) return NextResponse.json({ error: "Enter a question between 3 and 500 characters." }, { status: 400 });
  const vector = await embedText(question).catch(() => null);
  const terms = question.toLowerCase().split(/\W+/).filter((term: string) => term.length > 2);
  const candidates = await prisma.feedback.findMany({ where: { workspaceId: auth.user.workspaceId }, select: { id: true, content: true, embedding: { select: { vector: true } } }, take: 1000, orderBy: { createdAt: "desc" } });
  const cosine = (a: number[], b: number[]) => { let dot = 0, aa = 0, bb = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; } return aa && bb ? dot / Math.sqrt(aa * bb) : 0; };
  const sources = candidates.map((item) => { const words = terms.reduce((sum: number, term: string) => sum + (item.content.toLowerCase().includes(term) ? 1 : 0), 0); const stored = item.embedding?.vector; const similarity = vector && Array.isArray(stored) ? cosine(vector, stored as number[]) : 0; return { id: item.id, content: item.content, score: vector ? similarity + words * 0.005 : words }; }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 8).map(({ id, content }) => ({ id, content }));
  if (!sources.length) return NextResponse.json({ answer: "I could not find feedback that matches this question.", sources: [] });
  try {
    const answer = await answerFromFeedback(question, sources);
    if (!answer) return NextResponse.json({ error: "Ask LOOP needs ANTHROPIC_API_KEY configured." }, { status: 503 });
    return NextResponse.json({ answer, sources });
  } catch (error) { console.error("Ask LOOP failed", error); return NextResponse.json({ error: "Unable to generate an answer right now." }, { status: 502 }); }
}
