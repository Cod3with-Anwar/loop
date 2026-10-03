import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/src/lib/auth-options";
import { prisma } from "@/src/lib/prisma";
export default async function TrendsPage() {
  const session = await getServerSession(authOptions); if (!session?.user?.workspaceId) redirect("/login");
  const themes = await prisma.theme.findMany({ where: { workspaceId: session.user.workspaceId }, include: { _count: { select: { feedback: true } } }, orderBy: { feedback: { _count: "desc" } } });
  return <main className="mx-auto min-h-screen max-w-5xl bg-slate-950 p-6 text-white"><Link href="/dashboard" className="text-blue-400">← Dashboard</Link><h1 className="my-6 text-3xl font-bold">Theme trends</h1><div className="space-y-3">{themes.map((theme) => <article key={theme.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="flex justify-between"><h2 className="font-semibold">{theme.name}</h2><span>{theme._count.feedback} feedback items</span></div><p className="mt-2 text-sm text-slate-400">{theme.description || ""}</p></article>)}</div>{!themes.length && <p>No themes have been created yet.</p>}</main>;
}
