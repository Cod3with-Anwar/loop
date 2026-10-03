import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/auth";

const samples = [
  ["Support ticket", "I can't invite new teammates because the invitation screen keeps timing out."],
  ["App store review", "The latest release opens much faster and the new dashboard is easier to scan."],
  ["NPS survey", "Reporting is useful, but I need a way to export several charts together."],
  ["Sales call note", "The prospect needs single sign-on before they can move their team off spreadsheets."],
  ["Community post", "Saved filters have made it much quicker to review feedback every morning."],
  ["Support ticket", "I was charged twice after changing my plan and could not find the invoice."],
  ["App store review", "The mobile layout clips the submit button on smaller screens."],
  ["NPS survey", "Setup was clear and our team had the first project running in a few minutes."],
];

export async function POST() {
  const auth = await requireRole(["ADMIN", "ANALYST"]);
  if (auth.response) return auth.response;
  const rows = samples.map(([channel, content], index) => ({ channel, content, sourceRef: `SIM-${Date.now()}-${index}`, customerLabel: `Sample ${index + 1}`, workspaceId: auth.user.workspaceId }));
  const result = await prisma.feedback.createMany({ data: rows });
  return NextResponse.json({ imported: result.count }, { status: 201 });
}
