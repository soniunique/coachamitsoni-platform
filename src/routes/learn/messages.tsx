import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox, Loader2, MessageCircle, Plus, Send, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/messages")({ component: Messages });

type Profile = { id: string; full_name: string | null; avatar_url: string | null; role: string };
type Room = { id: string; name: string; description: string | null; is_active: boolean; created_at: string };
type RM = { id: string; chatroom_id: string; sender_id: string; body: string; created_at: string; sender?: Profile };
type C = { id: string; created_at: string };
type M = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; read_at: string | null };
type CV = C & { other?: Profile; last?: M; unread: number };

function Messages() {
  const [user, setUser] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [roomMsgs, setRoomMsgs] = useState<RM[]>([]);
  const [convs, setConvs] = useState<CV[]>([]);
  const [convId, setConvId] = useState("");
  const [inboxMsgs, setInboxMsgs] = useState<M[]>([]);
  const [body, setBody] = useState("");
  const [tab, setTab] = useState<"chatrooms" | "inbox">("chatrooms");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const room = useMemo(() => rooms.find(r => r.id === roomId), [rooms, roomId]);
  const conv = useMemo(() => convs.find(c => c.id === convId), [convs, convId]);

  async function loadRooms() {
    const { data, error: e } = await supabase.from("chatrooms").select("id,name,description,is_active,created_at").eq("is_active", true).order("created_at", { ascending: true });
    if (e) { setError(e.message); return; }
    const rows = (data || []) as Room[];
    setRooms(rows);
    if (!roomId && rows[0]) setRoomId(rows[0].id);
  }

  async function loadRoom(id: string) {
    const { data, error: e } = await supabase.from("chatroom_messages").select("id,chatroom_id,sender_id,body,created_at").eq("chatroom_id", id).order("created_at", { ascending: true });
    if (e) { setError(e.message); return; }
    const rows = (data || []) as RM[];
    const senderIds = [...new Set(rows.map(m => m.sender_id))];
    let profiles: Profile[] = [];
    if (senderIds.length) {
      const { data: ps, error: pe } = await supabase.from("profiles").select("id,full_name,avatar_url,role").in("id", senderIds);
      if (pe) { setError(pe.message); return; }
      profiles = (ps || []) as Profile[];
    }
    const profileMap = new Map(profiles.map(p => [p.id, p]));
    setRoomMsgs(rows.map(m => ({ ...m, sender: profileMap.get(m.sender_id) })));
    if (user) {
      const unread = rows.filter(m => m.sender_id !== user.id);
      if (unread.length) await supabase.from("chatroom_message_reads").upsert(unread.map(m => ({ message_id: m.id, user_id: user.id })), { onConflict: "message_id,user_id" });
    }
  }

  async function loadInbox() {
    if (!user) return;
    const { data: members, error: e } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", user.id);
    if (e) { setError(e.message); return; }
    const ids = (members || []).map(x => x.conversation_id);
    if (!ids.length) { setConvs([]); return; }
    const { data: cs, error: ce } = await supabase.from("conversations").select("id,created_at").in("id", ids).order("created_at", { ascending: false });
    if (ce) { setError(ce.message); return; }
    const { data: allMembers } = await supabase.from("conversation_members").select("conversation_id,user_id").in("conversation_id", ids);
    const others = [...new Set((allMembers || []).map(x => x.user_id).filter(x => x !== user.id))];
    const { data: ps } = others.length ? await supabase.from("profiles").select("id,full_name,avatar_url,role").in("id", others) : { data: [] as Profile[] };
    const map = new Map((ps || []).map(p => [p.id, p as Profile]));
    const out: CV[] = [];
    for (const c of (cs || []) as C[]) {
      const other = (allMembers || []).find(x => x.conversation_id === c.id && x.user_id !== user.id);
      const { data: last } = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,read_at").eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1);
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", c.id).neq("sender_id", user.id).is("read_at", null);
      out.push({ ...c, other: other ? map.get(other.user_id) : undefined, last: last?.[0] as M | undefined, unread: count || 0 });
    }
    setConvs(out);
    if (!convId && out[0]) setConvId(out[0].id);
  }

  async function loadInboxMessages(id: string) {
    const { data, error: e } = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,read_at").eq("conversation_id", id).order("created_at", { ascending: true });
    if (e) { setError(e.message); return; }
    const rows = (data || []) as M[];
    setInboxMsgs(rows);
    if (user) {
      const ids = rows.filter(m => m.sender_id !== user.id && !m.read_at).map(m => m.id);
      if (ids.length) await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", ids);
    }
  }

  async function load() {
    setLoading(true); setError("");
    const { data: { user: auth } } = await supabase.auth.getUser();
    if (!auth) { setError("You are not signed in."); setLoading(false); return; }
    const { data: p, error: e } = await supabase.from("profiles").select("id,full_name,avatar_url,role").eq("id", auth.id).maybeSingle();
    if (e || !p) { setError(e?.message || "Profile could not be loaded."); setLoading(false); return; }
    setUser(p as Profile);
    await loadRooms();
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (roomId) void loadRoom(roomId); }, [roomId]);
  useEffect(() => { if (tab === "inbox" && user) void loadInbox(); }, [tab, user]);
  useEffect(() => { if (convId) void loadInboxMessages(convId); }, [convId]);

  async function startInbox() {
    if (!user || user.role !== "student") return;
    const { data: admins } = await supabase.from("profiles").select("id,full_name,avatar_url,role").eq("role", "admin").order("full_name").limit(1);
    const admin = admins?.[0] as Profile | undefined;
    if (!admin) { setError("No Admin account is available."); return; }
    const { data: mine } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", user.id);
    for (const x of mine || []) {
      const { data: m } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", x.conversation_id).eq("user_id", admin.id);
      if (m?.length) { setConvId(x.conversation_id); setTab("inbox"); return; }
    }
    const { data: c, error: e } = await supabase.from("conversations").insert({}).select("id,created_at").single();
    if (e || !c) { setError(e?.message || "Could not start conversation."); return; }
    const { error: me } = await supabase.from("conversation_members").insert([{ conversation_id: c.id, user_id: user.id }, { conversation_id: c.id, user_id: admin.id }]);
    if (me) { setError(me.message); return; }
    setConvId(c.id); setTab("inbox"); await loadInbox();
  }

  async function sendRoom() {
    if (!user || !roomId || !body.trim()) return;
    setSending(true); setError("");
    const { error: e } = await supabase.from("chatroom_messages").insert({ chatroom_id: roomId, sender_id: user.id, body: body.trim() });
    if (e) setError(e.message); else { setBody(""); await loadRoom(roomId); }
    setSending(false);
  }

  async function sendInbox() {
    if (!user || !convId || !body.trim()) return;
    setSending(true); setError("");
    const { error: e } = await supabase.from("messages").insert({ conversation_id: convId, sender_id: user.id, body: body.trim() });
    if (e) setError(e.message); else { setBody(""); await loadInboxMessages(convId); await loadInbox(); }
    setSending(false);
  }

  async function createRoom() {
    if (!user || user.role !== "admin") return;
    const name = window.prompt("Chatroom name", "");
    if (!name?.trim()) return;
    const description = window.prompt("Short description", "");
    const { error: e } = await supabase.from("chatrooms").insert({ name: name.trim(), description: description?.trim() || null, created_by: user.id });
    if (e) setError(e.message); else await loadRooms();
  }

  if (loading) return <LearnShell><div className="learn-card p-6 text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={18}/>Loading messages...</div></LearnShell>;

  return <LearnShell>
    <SectionHeader eyebrow={user?.role === "admin" ? "Admin · Community" : "Community"} title="Messages" description="Connect with Amit and the learning community." action={user?.role === "admin" ? <div className="flex gap-2"><Link to="/learn/manage/chatrooms" className="learn-secondary-button"><Users size={16}/>Manage chatrooms</Link><button type="button" onClick={() => void createRoom()} className="learn-primary-button"><Plus size={16}/>New chatroom</button></div> : undefined}/>
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    <div className="learn-card overflow-hidden p-0">
      <div className="flex border-b border-white/10"><button type="button" onClick={() => setTab("chatrooms")} className={`px-6 py-4 text-sm font-semibold ${tab === "chatrooms" ? "border-b-2 border-cyan-300 text-white" : "text-slate-500"}`}><MessageCircle className="mr-2 inline" size={16}/>Chatrooms</button><button type="button" onClick={() => setTab("inbox")} className={`px-6 py-4 text-sm font-semibold ${tab === "inbox" ? "border-b-2 border-cyan-300 text-white" : "text-slate-500"}`}><Inbox className="mr-2 inline" size={16}/>Inbox</button></div>
      {tab === "chatrooms" ? <div className="grid min-h-[600px] lg:grid-cols-[300px_1fr]"><aside className="border-r border-white/10"><div className="px-5 py-4 text-xs font-bold uppercase tracking-[.16em] text-slate-500">Chatrooms</div>{rooms.map(r => <button key={r.id} type="button" onClick={() => setRoomId(r.id)} className={`w-full px-5 py-4 text-left ${r.id === roomId ? "bg-white/8" : "hover:bg-white/5"}`}><div className="font-semibold">{r.name}</div><div className="mt-1 truncate text-xs text-slate-500">{r.description || "Join the conversation"}</div></button>)}{!rooms.length && <div className="px-5 py-8 text-sm text-slate-500">No chatrooms yet.</div>}</aside><section className="flex min-h-[600px] flex-col"><div className="border-b border-white/10 px-6 py-5"><div className="text-lg font-bold">{room?.name || "Chatroom"}</div><div className="mt-1 text-sm text-slate-500">{room?.description || "Join the conversation"}</div></div><div className="flex-1 space-y-4 overflow-y-auto p-6">{roomMsgs.length ? roomMsgs.map(m => <RoomBubble key={m.id} m={m}/>) : <div className="flex h-full items-center justify-center text-sm text-slate-500">No messages yet. Be the first to say hello.</div>}</div><Composer body={body} setBody={setBody} onSend={() => void sendRoom()} sending={sending}/></section></div> : <div className="grid min-h-[600px] lg:grid-cols-[300px_1fr]"><aside className="border-r border-white/10"><div className="px-5 py-4 text-xs font-bold uppercase tracking-[.16em] text-slate-500">Inbox</div>{convs.map(c => <button key={c.id} type="button" onClick={() => setConvId(c.id)} className={`w-full px-5 py-4 text-left ${c.id === convId ? "bg-white/8" : "hover:bg-white/5"}`}><div className="flex items-center justify-between"><span className="font-semibold">{c.other?.full_name || "Student"}</span>{c.unread > 0 && <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[10px] font-bold text-slate-950">{c.unread}</span>}</div><div className="mt-1 truncate text-xs text-slate-500">{c.last?.body || "No messages yet"}</div></button>)}{!convs.length && <div className="p-5 text-sm text-slate-500">{user?.role === "admin" ? "No student conversations yet." : <button type="button" onClick={() => void startInbox()} className="learn-primary-button">Message Amit</button>}</div>}</aside><section className="flex min-h-[600px] flex-col"><div className="border-b border-white/10 px-6 py-5"><div className="text-lg font-bold">{conv?.other?.full_name || "Conversation"}</div><div className="text-xs text-slate-500">{conv?.other?.role === "admin" ? "Admin" : "Student"}</div></div><div className="flex-1 space-y-3 overflow-y-auto p-6">{inboxMsgs.length ? inboxMsgs.map(m => <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${m.sender_id === user?.id ? "bg-cyan-400 text-slate-950" : "bg-white/7 text-slate-200"}`}>{m.body}<div className="mt-1 text-[10px] opacity-60">{new Date(m.created_at).toLocaleString()}</div></div></div>) : <div className="flex h-full items-center justify-center text-sm text-slate-500">Select a conversation to begin.</div>}</div>{convId && <Composer body={body} setBody={setBody} onSend={() => void sendInbox()} sending={sending}/>}</section></div>}
    </div>
  </LearnShell>;
}

function RoomBubble({ m }: { m: RM }) {
  const sender = m.sender;
  const name = sender?.full_name || "Member";
  const isAdmin = sender?.role === "admin";
  return <div className="flex gap-3"><div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">{sender?.avatar_url ? <img src={sender.avatar_url} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-xs font-semibold">{name.slice(0, 1).toUpperCase()}</div>}</div><div className="max-w-[78%]"><div className="flex items-center gap-2"><span className="text-sm font-semibold">{name}</span>{isAdmin && <span className="rounded bg-orange-400/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-orange-300">CREATOR</span>}</div><div className="mt-1 whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white/6 px-4 py-3 text-sm text-slate-200">{m.body}</div><div className="mt-1 text-[10px] text-slate-600">{new Date(m.created_at).toLocaleString()}</div></div></div>;
}

function Composer({ body, setBody, onSend, sending }: { body: string; setBody: (v: string) => void; onSend: () => void; sending: boolean }) {
  return <div className="border-t border-white/10 p-4"><div className="flex gap-2"><textarea value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }} rows={2} placeholder="Type a message" className="min-h-[52px] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"/><button type="button" onClick={onSend} disabled={sending || !body.trim()} className="learn-primary-button self-end disabled:opacity-50">{sending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}Send</button></div></div>;
}
