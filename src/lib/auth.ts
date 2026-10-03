import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/src/lib/auth-options";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.workspaceId) return null;
  return session.user;
}

export async function requireRole(roles: string[]) {
  const user = await requireUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!roles.includes(user.role)) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}
