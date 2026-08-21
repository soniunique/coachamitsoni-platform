import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarDays, MessageSquare, Sparkles, Users } from "lucide-react";
import { ContinueCard, LearnShell, SectionHeader } from "@/components/learn/LearnShell";

export const Route = createFileRoute("/learn/")({ component: LearnHome });

function LearnHome() {
  return <LearnShell><SectionHeader eyebrow="Student dashboard" title="Welcome to your learning hub" description="Learn by building. Your workshops, courses, announcements and conversations stay in one place." action={<Link to="/learn/workshops" className="learn-secondary-button">Explore workshops <ArrowUpRight size={15}/></Link>} />
    <div className="grid gap-4 md:grid-cols-3 mb-6">
      {[['Next workshop','AI Agents from Scratch','Saturday · Live online',CalendarDays],['Course progress','Build Your First AI Agent','42% complete',Sparkles],['Community','AI Builders Community','100+ active members',Users]].map(([label,title,meta,Icon])=><div key={String(label)} className="learn-card p-5"><div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">{label as string}</div><div className="mt-2 font-semibold">{title as string}</div><div className="mt-1 text-xs text-slate-400">{meta as string}</div></div><div className="learn-icon-tile"><Icon size={18}/></div></div></div>)}
    </div>
    <ContinueCard />
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
      <div className="learn-card p-6"><div className="flex items-center justify-between"><div><div className="learn-eyebrow">Latest from Amit</div><h2 className="mt-2 text-xl font-bold">Build practical AI skills</h2></div><Link to="/learn" className="text-xs text-cyan-300">View all</Link></div><div className="mt-5 space-y-4"><div className="learn-feed-item"><div className="learn-avatar">AS</div><div><div className="font-semibold">New live workshop announced</div><p className="mt-1 text-sm leading-6 text-slate-400">A hands-on session focused on building an AI agent from scratch with practical automation.</p><div className="mt-2 text-xs text-slate-500">Amit Soni · Today</div></div></div><div className="learn-feed-item"><div className="learn-avatar purple">AI</div><div><div className="font-semibold">A new learning path is available</div><p className="mt-1 text-sm leading-6 text-slate-400">Start with AI agents, then move into voice agents and no-code automation.</p><div className="mt-2 text-xs text-slate-500">Learning Hub · This week</div></div></div></div></div>
      <div className="learn-card p-6"><div className="learn-eyebrow">Need help?</div><h2 className="mt-2 text-xl font-bold">Talk to us</h2><p className="mt-2 text-sm leading-6 text-slate-400">Questions about your enrollment or learning path?</p><Link to="/learn/messages" className="learn-secondary-button mt-5 w-full"><MessageSquare size={15}/> Open messages</Link></div>
    </div>
  </LearnShell>;
}
