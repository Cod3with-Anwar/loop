import { prisma } from "@/src/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  let input: { name?: string; email?: string; password?: string; workspaceName?: string };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const password = input.password;
  const workspaceName = input.workspaceName?.trim();
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length < 12 || !workspaceName) {
    return NextResponse.json({ error: "Provide a name, valid email, workspace name, and password of at least 12 characters." }, { status: 400 });
  }
  if (await prisma.user.findUnique({ where: { email } })) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({ data: { name: workspaceName } });
    return tx.user.create({ data: { name, email, passwordHash, role: "ADMIN", workspaceId: workspace.id }, select: { id: true } });
  });
  return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
}
