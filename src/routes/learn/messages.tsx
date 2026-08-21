import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
export const Route = createFileRoute("/learn/messages")({ component: Messages });
function Messages(){return <LearnShell><SectionHeader eyebrow="Community" title="Messages" description="Your conversations with Amit and the learning community."/><div className="learn-card p-6"><div className="learn-empty"><div className="learn-icon-tile"><Send size={20}/></div><h2 className="mt-4 text-lg font-bold">Your messages will appear here</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">Messaging is ready for the next Supabase data layer. We'll connect real conversations, unread counts and notifications after the dashboard shell is approved.</p></div></div></LearnShell>}
