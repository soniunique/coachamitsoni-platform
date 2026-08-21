import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
export const Route = createFileRoute("/learn/notifications")({ component: Notifications });
function Notifications(){return <LearnShell><SectionHeader eyebrow="Updates" title="Notifications" description="Workshop reminders, course updates and learning announcements."/><div className="learn-card p-6"><div className="learn-empty"><div className="learn-icon-tile mx-auto"><Bell size={20}/></div><h2 className="mt-4 text-lg font-bold">No new notifications</h2><p className="mt-2 text-sm text-slate-400">Notifications will appear here when the data layer is connected.</p></div></div></LearnShell>}
