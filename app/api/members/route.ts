import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/auth";

export async function GET() {
  const auth = await requireRole(["ADMIN"]);
  if (auth.response) return auth.response;
  const members = await prisma.user.findMany({ where: { workspaceId: auth.user.workspaceId }, select: { id: true, name: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(members);
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role;
  const password = body.password;
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !["ADMIN", "ANALYST", "VIEWER"].includes(role) || typeof password !== "string" || password.length < 12) return NextResponse.json({ error: "Enter a name, valid email, supported role, and temporary password with at least 12 characters." }, { status: 400 });
  try {
    const user = await prisma.user.create({ data: { name, email, role, passwordHash: await bcrypt.hash(password, 12), workspaceId: auth.user.workspaceId }, select: { id: true, name: true, email: true, role: true } });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "That email already has an account." }, { status: 409 });
    console.error("Member creation failed", error);
    return NextResponse.json({ error: "Could not add member." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string" || !["ADMIN", "ANALYST", "VIEWER"].includes(body.role)) return NextResponse.json({ error: "Member and supported role are required." }, { status: 400 });
  if (body.id === auth.user.id && body.role !== "ADMIN") return NextResponse.json({ error: "Admins cannot remove their own admin role." }, { status: 400 });
  const result = await prisma.user.updateMany({ where: { id: body.id, workspaceId: auth.user.workspaceId }, data: { role: body.role } });
  return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Member not found." }, { status: 404 });
}
