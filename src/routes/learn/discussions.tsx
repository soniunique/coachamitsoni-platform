import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Pin, Plus, Send, ShieldCheck, Lock, Unlock, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { LearnModal } from "@/components/learn/LearnModal";
import { supabase } from "@/integrations/supabase/client";

type Course = { id: string; title: string; program_id: string };
type Thread = { id: string; course_id: string; author_id: string; title: string; body: string; pinned: boolean; locked: boolean; created_at: string; updated_at: string; author?: { full_name: string | null; role: string } };
type Reply = { id: string; thread_id: string; author_id: string; body: string; created_at: string; author?: { full_name: string | null; role: string } };

export const Route = createFileRoute("/learn/discussions")({ component: Discussions });

function Discussions() {
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [openThread, setOpenThread] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Please sign in."); setLoading(false); return; }
    setUserId(user.id);
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const admin = profile?.role === "admin"; setIsAdmin(admin);
    if (admin) {
      const { data, error: e } = await supabase.from("courses").select("id,title,program_id").eq("status", "published").order("title");
      if (e) setError(e.message); else { setCourses((data || []) as Course[]); if (!courseId && data?.[0]) setCourseId(data[0].id); }
    } else {
      const { data: enrollments, error: ee } = await supabase.from("program_enrollments").select("program_id").eq("user_id", user.id).in("status", ["active", "completed"]);
      if (ee) { setError(ee.message); setLoading(false); return; }
      const pids = [...new Set((enrollments || []).map(x => x.program_id))];
      if (!pids.length) { setCourses([]); setLoading(false); return; }
      const { data, error: ce } = await supabase.from("courses").select("id,title,program_id").eq("status", "published").in("program_id", pids).order("title");
      if (ce) setError(ce.message); else { setCourses((data || []) as Course[]); if (!courseId && data?.[0]) setCourseId(data[0].id); }
    }
    setLoading(false);
  }

  async function loadThreads(id: string) {
    if (!id) return;
    const { data, error: e } = await supabase.from("discussion_threads").select("id,course_id,author_id,title,body,pinned,locked,created_at,updated_at").eq("course_id", id).order("pinned", { ascending: false }).order("updated_at", { ascending: false });
    if (e) { setError(e.message); return; }
    const rows = (data || []) as Thread[];
    const ids = [...new Set(rows.map(r => r.author_id))];
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,full_name,role").in("id", ids) : { data: [] };
    const map = new Map((profiles || []).map((p: any) => [p.id, p]));
    setThreads(rows.map(r => ({ ...r, author: map.get(r.author_id) })));
    if (!openThread && rows[0]) setOpenThread(rows[0].id);
  }

  async function loadReplies(threadId: string) {
    const { data, error: e } = await supabase.from("discussion_replies").select("id,thread_id,author_id,body,created_at").eq("thread_id", threadId).order("created_at");
    if (e) { setError(e.message); return; }
    const rows = (data || []) as Reply[];
    const ids = [...new Set(rows.map(r => r.author_id))];
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,full_name,role").in("id", ids) : { data: [] };
    const map = new Map((profiles || []).map((p: any) => [p.id, p]));
    setReplies(prev => ({ ...prev, [threadId]: rows.map(r => ({ ...r, author: map.get(r.author_id) })) }));
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (courseId) void loadThreads(courseId); }, [courseId]);
  useEffect(() => { if (openThread) void loadReplies(openThread); }, [openThread]);

  const course = useMemo(() => courses.find(c => c.id === courseId), [courses, courseId]);
  const activeThread = useMemo(() => threads.find(t => t.id === openThread), [threads, openThread]);

  async function createThread() {
    if (!userId || !courseId || !newTitle.trim() || !newBody.trim() || saving) return;
    setSaving(true); setError("");
    const { data, error: e } = await supabase.from("discussion_threads").insert({ course_id: courseId, author_id: userId, title: newTitle.trim(), body: newBody.trim() }).select("id").single();
    if (e) setError(e.message); else { setNewTitle(""); setNewBody(""); setShowComposer(false); await loadThreads(courseId); if (data?.id) setOpenThread(data.id); }
    setSaving(false);
  }

  async function createReply() {
    if (!userId || !openThread || !replyBody.trim() || saving || activeThread?.locked) return;
    setSaving(true); setError("");
    const { error: e } = await supabase.from("discussion_replies").insert({ thread_id: openThread, author_id: userId, body: replyBody.trim() });
    if (e) setError(e.message); else { setReplyBody(""); await loadReplies(openThread); await loadThreads(courseId); }
    setSaving(false);
  }

  async function moderate(field: "pinned" | "locked", value: boolean) {
    if (!isAdmin || !activeThread) return;
    const { error: e } = await supabase.from("discussion_threads").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", activeThread.id);
    if (e) setError(e.message); else await loadThreads(courseId);
  }

  if (loading) return <LearnShell><div className="learn-card p-6 text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={18}/>Loading discussions...</div></LearnShell>;

  return <LearnShell>
    <SectionHeader eyebrow="Community" title="Discussions" description="Ask questions, share ideas and learn together inside each course." action={<button type="button" onClick={() => { setError(""); setShowComposer(true); }} disabled={!courseId} className="learn-primary-button"><Plus size={16}/>New discussion</button>} />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {!courses.length ? <div className="learn-card p-10 text-center"><MessageSquare className="mx-auto text-cyan-300" size={34}/><h2 className="mt-4 text-lg font-bold">No course discussions yet</h2><p className="mt-2 text-sm text-slate-500">Join a program to access its course community.</p></div> : <>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><label className="text-xs font-bold uppercase tracking-[.16em] text-slate-500" htmlFor="discussion-course">Course</label><select id="discussion-course" value={courseId} onChange={e => { setCourseId(e.target.value); setOpenThread(""); setReplies({}); }} className="learn-input sm:max-w-md">{courses.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.title}</option>)}</select></div>
      <LearnModal open={showComposer} onClose={() => { if (!saving) setShowComposer(false); }} title="Start a discussion" description="Post a question or idea inside the selected course." context={course?.title} footer={<><button type="button" onClick={() => setShowComposer(false)} disabled={saving} className="learn-secondary-button">Cancel</button><button type="button" onClick={() => void createThread()} disabled={saving || !newTitle.trim() || !newBody.trim()} className="learn-primary-button"><Send size={15}/>{saving ? "Posting…" : "Post discussion"}</button></>}>
        <div className="space-y-4"><label className="block text-sm font-medium">Title<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} className="learn-input mt-2" placeholder="Discussion title" maxLength={200}/></label><label className="block text-sm font-medium">Your message<textarea value={newBody} onChange={e=>setNewBody(e.target.value)} className="learn-input mt-2 min-h-40 resize-y" placeholder="What would you like to discuss?" maxLength={10000}/></label></div>
      </LearnModal>
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="learn-card overflow-hidden"><div className="border-b border-white/10 px-5 py-4 text-xs font-bold uppercase tracking-[.16em] text-slate-500">Topics · {threads.length}</div><div className="divide-y divide-white/5">{threads.map(t => <button key={t.id} type="button" onClick={() => setOpenThread(t.id)} className={`w-full p-5 text-left ${t.id === openThread ? "bg-cyan-400/8" : "hover:bg-white/5"}`}><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="font-semibold leading-5">{t.title}</div><div className="mt-2 text-xs text-slate-500">{t.author?.full_name || "Member"} · {new Date(t.updated_at).toLocaleDateString()}</div></div>{t.pinned && <Pin size={15} className="shrink-0 text-cyan-300"/>}{t.locked && <Lock size={14} className="shrink-0 text-amber-300"/>}</div></button>)}{!threads.length && <div className="p-7 text-sm text-slate-500">No discussions yet. Start the first one.</div>}</div></aside>
        <main className="learn-card min-h-[520px] p-6">{activeThread ? <><div className="border-b border-white/10 pb-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">{activeThread.title}</h2><div className="mt-2 text-xs text-slate-500">{activeThread.author?.full_name || "Member"} · {new Date(activeThread.created_at).toLocaleString()}</div></div>{isAdmin && <div className="flex gap-2"><button type="button" onClick={() => void moderate("pinned", !activeThread.pinned)} className="learn-secondary-button"><Pin size={14}/>{activeThread.pinned ? "Unpin" : "Pin"}</button><button type="button" onClick={() => void moderate("locked", !activeThread.locked)} className="learn-secondary-button">{activeThread.locked ? <Unlock size={14}/> : <Lock size={14}/>} {activeThread.locked ? "Unlock" : "Lock"}</button></div>}</div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{activeThread.body}</p></div><div className="space-y-4 py-5">{(replies[activeThread.id] || []).map(r => <div key={r.id} className="rounded-xl border border-white/8 bg-white/[.03] p-4"><div className="flex items-center gap-2 text-xs"><ShieldCheck size={14} className={r.author?.role === "admin" ? "text-cyan-300" : "text-slate-500"}/><span className="font-semibold text-slate-200">{r.author?.full_name || "Member"}</span>{r.author?.role === "admin" && <span className="text-cyan-300">Admin</span>}<span className="text-slate-600">{new Date(r.created_at).toLocaleString()}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{r.body}</p></div>)}{!(replies[activeThread.id] || []).length && <div className="py-5 text-sm text-slate-500">No replies yet.</div>}</div>{activeThread.locked ? <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">This discussion is locked by an administrator.</div> : <div className="flex gap-2"><textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} className="learn-input min-h-20 resize-y" placeholder="Write a reply…" maxLength={10000}/><button type="button" onClick={() => void createReply()} disabled={saving || !replyBody.trim()} className="learn-primary-button self-end"><Send size={15}/></button></div>}</> : <div className="flex h-full items-center justify-center text-sm text-slate-500">Select a discussion.</div>}</main>
      </div>
    </>}
  </LearnShell>;
}
