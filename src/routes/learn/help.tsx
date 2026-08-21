import { createFileRoute } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
export const Route = createFileRoute("/learn/help")({ component: Help });
function Help(){return <LearnShell><SectionHeader eyebrow="Support" title="Help" description="Get assistance with your courses, workshops and account."/><div className="learn-card p-6"><div className="learn-empty"><div className="learn-icon-tile mx-auto"><CircleHelp size={20}/></div><h2 className="mt-4 text-lg font-bold">Support center</h2><p className="mt-2 text-sm text-slate-400">FAQs, enrollment support and contact options will be connected here.</p></div></div></LearnShell>}
