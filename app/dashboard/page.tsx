import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth-options";
import { prisma } from "@/src/lib/prisma";
import SignOutButton from "@/src/components/sign-out";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) redirect("/login");
  const workspaceId = session.user.workspaceId;
  const since = new Date(Date.now() - 7 * 86400000);
  const [total, negative, newThisWeek, sentiments, themes, recent] = await Promise.all([
    prisma.feedback.count({ where: { workspaceId } }),
    prisma.feedback.count({ where: { workspaceId, sentiment: "NEG" } }),
    prisma.feedback.count({ where: { workspaceId, status: "NEW", createdAt: { gte: since } } }),
    prisma.feedback.groupBy({ by: ["sentiment"], where: { workspaceId }, _count: { _all: true } }),
    prisma.theme.findMany({ where: { workspaceId }, include: { _count: { select: { feedback: true } } }, orderBy: { feedback: { _count: "desc" } }, take: 5 }),
    prisma.feedback.findMany({ where: { workspaceId }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);
  const sentimentCounts = Object.fromEntries(sentiments.map((entry) => [entry.sentiment || "UNCLASSIFIED", entry._count._all]));
  const bars = Array.from({ length: 7 }, (_, index) => { const day = new Date(); day.setDate(day.getDate() - (6 - index)); day.setHours(0, 0, 0, 0); const next = new Date(day); next.setDate(next.getDate() + 1); return { label: day.toLocaleDateString(undefined, { weekday: "short" }), count: recent.filter((item) => item.createdAt >= day && item.createdAt < next).length }; });
  const max = Math.max(1, ...bars.map((bar) => bar.count));
  return <main className="min-h-screen bg-slate-950 text-white"><div className="mx-auto max-w-7xl p-6">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5"><div><h1 className="text-2xl font-bold">LOOP</h1><p className="text-sm text-slate-400">{session.user.name} · {session.user.role} · Feedback intelligence</p></div><nav className="flex flex-wrap gap-4 text-sm"><Link href="/inbox">Inbox</Link><Link href="/trends">Trends</Link><Link href="/ask">Ask LOOP</Link><Link href="/reports">Reports</Link>{session.user.role === "ADMIN" && <Link href="/settings">Members</Link>}<SignOutButton /></nav></header>
    <h2 className="mb-5 mt-8 text-2xl font-semibold">Workspace overview</h2>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Total feedback", total], ["Negative feedback", `${total ? Math.round(negative / total * 100) : 0}%`], ["New this week", newThisWeek], ["Workspace", "Private"]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</section>
    <section className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-semibold">Feedback volume · 7 days</h3><div className="mt-6 flex h-44 items-end justify-around gap-3">{bars.map((bar) => <div key={bar.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-xs">{bar.count}</span><div className="w-full rounded-t bg-blue-500" style={{ height: `${Math.max(4, bar.count / max * 125)}px` }} /><span className="text-xs text-slate-400">{bar.label}</span></div>)}</div></div>
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-semibold">Sentiment breakdown</h3>{["POS", "NEU", "NEG", "UNCLASSIFIED"].map((key) => <div key={key} className="mt-5"><div className="mb-1 flex justify-between text-sm"><span>{key}</span><span>{sentimentCounts[key] || 0}</span></div><div className="h-2 rounded bg-slate-800"><div className="h-2 rounded bg-emerald-500" style={{ width: `${total ? (sentimentCounts[key] || 0) / total * 100 : 0}%` }} /></div></div>)}</div></section>
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-semibold">Top themes</h3>{themes.length ? themes.map((theme) => <div key={theme.id} className="mt-4 flex justify-between border-b border-slate-800 pb-3"><span>{theme.name}</span><span className="text-slate-400">{theme._count.feedback} items</span></div>) : <p className="mt-4 text-slate-400">No themes yet. Add feedback and classify it to start seeing trends.</p>}</section>
  </div></main>;
}
