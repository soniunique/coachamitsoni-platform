import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/messages")({ component: Messages });

type Profile = { id: string; full_name: string | null; role: string };
type Conversation = { id: string; created_at: string };
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; read_at: string | null };
type ConversationView = Conversation & { other?: Profile; last?: Message; unread: number };

function Messages() {
  const [user, setUser] = useState<Profile | null>(null);
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(() => conversations.find(c => c.id === selectedId), [conversations, selectedId]);

  async function loadMessages(conversationId: string) {
    const { data, error: e } = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,read_at").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    if (e) { setError(e.message); return; }
    const rows = (data || []) as Message[];
    setMessages(rows);
    const unreadIds = rows.filter(m => m.sender_id !== user?.id && !m.read_at).map(m => m.id);
    if (unreadIds.length) await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
  }

  async function load() {
    setLoading(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("You are not signed in."); setLoading(false); return; }
    const { data: me, error: pe } = await supabase.from("profiles").select("id,full_name,role").eq("id", auth.user.id).maybeSingle();
    if (pe || !me) { setError(pe?.message || "Profile could not be loaded."); setLoading(false); return; }
    setUser(me as Profile);
    const { data: adminRows } = await supabase.from("profiles").select("id,full_name,role").eq("role", "admin").order("full_name");
    setAdmins((adminRows || []) as Profile[]);

    const { data: memberRows, error: meErr } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", auth.user.id);
    if (meErr) { setError(meErr.message); setLoading(false); return; }
    const ids = (memberRows || []).map(r => r.conversation_id);
    if (!ids.length) { setConversations([]); setLoading(false); return; }
    const { data: convRows, error: ce } = await supabase.from("conversations").select("id,created_at").in("id", ids).order("created_at", { ascending: false });
    if (ce) { setError(ce.message); setLoading(false); return; }
    const { data: allMembers } = await supabase.from("conversation_members").select("conversation_id,user_id").in("conversation_id", ids);
    const otherIds = [...new Set((allMembers || []).map(m => m.user_id).filter(id => id !== auth.user.id))];
    const { data: otherProfiles } = otherIds.length ? await supabase.from("profiles").select("id,full_name,role").in("id", otherIds) : { data: [] as Profile[] };
    const profileMap = new Map((otherProfiles || []).map(p => [p.id, p as Profile]));
    const result: ConversationView[] = [];
    for (const c of (convRows || []) as Conversation[]) {
      const member = (allMembers || []).find(m => m.conversation_id === c.id && m.user_id !== auth.user.id);
      const { data: lastRows } = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,read_at").eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1);
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", c.id).neq("sender_id", auth.user.id).is("read_at", null);
      result.push({ ...c, other: member ? profileMap.get(member.user_id) : undefined, last: lastRows?.[0] as Message | undefined, unread: count || 0 });
    }
    setConversations(result);
    if (result.length && !selectedId) { setSelectedId(result[0].id); await loadMessages(result[0].id); }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (selectedId) void loadMessages(selectedId); }, [selectedId]);

  async function startConversation() {
    if (!user || user.role !== "student" || !admins[0]) return;
    setError("");
    const { data: existingMembers } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", user.id);
    const existingIds = (existingMembers || []).map(r => r.conversation_id);
    for (const id of existingIds) {
      const { data: members } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", id).eq("user_id", admins[0].id);
      if (members?.length) { setSelectedId(id); return; }
    }
    const { data: conversation, error: ce } = await supabase.from("conversations").insert({}).select("id,created_at").single();
    if (ce || !conversation) { setError(ce?.message || "Could not start conversation."); return; }
    const { error: memberError } = await supabase.from("conversation_members").insert([{ conversation_id: conversation.id, user_id: user.id }, { conversation_id: conversation.id, user_id: admins[0].id }]);
    if (memberError) { setError(memberError.message); return; }
    setSelectedId(conversation.id); await load();
  }

  async function sendMessage() {
    if (!user || !selectedId || !body.trim()) return;
    setSending(true); setError("");
    const { error: e } = await supabase.from("messages").insert({ conversation_id: selectedId, sender_id: user.id, body: body.trim() });
    if (e) setError(e.message); else { setBody(""); await loadMessages(selectedId); await load(); }
    setSending(false);
  }

  if (loading) return <LearnShell><div className="learn-card p-6 text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={18}/>Loading messages...</div></LearnShell>;

  return <LearnShell>
    <SectionHeader eyebrow={user?.role === "admin" ? "Admin · Communication" : "Community"} title="Messages" description={user?.role === "admin" ? "Reply to students and keep conversations organized." : "Message Amit and keep your learning conversations in one place."} action={user?.role === "student" && !conversations.length ? <button type="button" onClick={() => void startConversation()} className="learn-primary-button"><MessageSquare size={16}/>Start a conversation</button> : undefined}/>
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {!conversations.length ? <div className="learn-card p-8 text-center"><div className="learn-icon-tile mx-auto"><MessageSquare size={20}/></div><h2 className="mt-4 text-lg font-bold">{user?.role === "admin" ? "No conversations yet" : "Start a conversation"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{user?.role === "admin" ? "Student conversations will appear here when a student sends a message." : "Ask a question, share an update, or get help with your learning."}</p>{user?.role === "student" && <button type="button" onClick={() => void startConversation()} className="learn-primary-button mx-auto mt-5"><MessageSquare size={16}/>Message Amit</button>}</div> : <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <div className="learn-card overflow-hidden p-0"><div className="border-b border-white/10 px-5 py-4 text-sm font-semibold">Conversations</div><div className="divide-y divide-white/5">{conversations.map(c => <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} className={`w-full p-4 text-left transition ${selectedId === c.id ? "bg-white/8" : "hover:bg-white/5"}`}><div className="flex items-center justify-between gap-3"><span className="font-semibold">{c.other?.full_name || (user?.role === "admin" ? "Student" : "Amit")}</span>{c.unread > 0 && <span className="rounded-full bg-cyan-400 px-2 py-0.5 text-[10px] font-bold text-slate-950">{c.unread}</span>}</div><p className="mt-1 truncate text-xs text-slate-500">{c.last?.body || "No messages yet"}</p></button>)}</div></div>
      <div className="learn-card flex min-h-[520px] flex-col p-0"><div className="border-b border-white/10 px-6 py-4"><div className="font-semibold">{selected?.other?.full_name || (user?.role === "admin" ? "Student" : "Amit")}</div><div className="text-xs text-slate-500">{selected?.other?.role === "admin" ? "Admin" : "Student"}</div></div><div className="flex-1 space-y-3 overflow-y-auto p-6">{messages.length ? messages.map(m => <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${m.sender_id === user?.id ? "bg-cyan-400 text-slate-950" : "bg-white/7 text-slate-200"}`}><div className="whitespace-pre-wrap">{m.body}</div><div className={`mt-1 text-[10px] ${m.sender_id === user?.id ? "text-slate-700" : "text-slate-500"}`}>{new Date(m.created_at).toLocaleString()}</div></div></div>) : <div className="flex h-full items-center justify-center text-sm text-slate-500">No messages yet. Send the first message.</div>}</div><div className="border-t border-white/10 p-4"><div className="flex gap-2"><textarea value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} rows={2} placeholder="Write a message..." className="min-h-[52px] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"/><button type="button" onClick={() => void sendMessage()} disabled={sending || !body.trim()} className="learn-primary-button self-end disabled:opacity-50">{sending ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>}Send</button></div><div className="mt-2 text-[10px] text-slate-600">Press Enter to send · Shift+Enter for a new line</div></div></div>
    </div>}
  </LearnShell>;
}
