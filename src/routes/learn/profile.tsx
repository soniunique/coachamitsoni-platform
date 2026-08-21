import { createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
export const Route = createFileRoute("/learn/profile")({ component: Profile });
function Profile(){return <LearnShell><SectionHeader eyebrow="Account" title="Profile" description="Manage your student profile and learning identity."/><div className="learn-card p-6"><div className="flex items-center gap-4"><div className="learn-avatar" style={{height:64,width:64}}>AS</div><div><h2 className="text-xl font-bold">Amit Soni Learning Hub</h2><p className="text-sm text-slate-400">Student profile settings will connect to Supabase in the next data-layer step.</p></div></div></div></LearnShell>}
