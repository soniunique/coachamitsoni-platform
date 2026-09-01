import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Megaphone, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Program = { id: string; title: string };
type Announcement = { id: string; title: string; body: string; audience_type: "all" | "program"; program_id: string | null; published_at: string; created_at: string };
type Draft = { id?: string; title: string; body: string; audienceType: "all" | "program"; programId: string };

export const Route = createFileRoute("/learn/manage/announcements")({ component: AnnouncementsManager });

function AnnouncementsManager() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You are not signed in."); setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") { setError("Only admins can manage announcements."); setLoading(false); return; }
    const [{ data: announcements, error: announcementError }, { data: programData, error: programError }] = await Promise.all([
      supabase.from("announcements").select("id,title,body,audience_type,program_id,published_at,created_at").order("created_at", { ascending: false }),
      supabase.from("programs").select("id,title").order("sort_order", { ascending: true }),
    ]);
    if (announcementError || programError) setError(announcementError?.message || programError?.message || "Unable to load announcements.");
    else { setItems((announcements || []) as Announcement[]); setPrograms((programData || []) as Program[]); }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);
  function edit(a: Announcement) { setDraft({ id: a.id, title: a.title, body: a.body, audienceType: a.audience_type, programId: a.program_id || "" }); setSuccess(""); setError(""); }
  function create() { setDraft({ title: "", body: "", audienceType: "all", programId: "" }); setSuccess(""); setError(""); }
  function setAudience(value: string) { if (!draft) return; setDraft(value === "all" ? { ...draft, audienceType: "all", programId: "" } : { ...draft, audienceType: "program", programId: value }); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!draft) return;
    if (!draft.title.trim() || !draft.body.trim()) { setError("Title and message are required."); return; }
    if (draft.audienceType === "program" && !draft.programId) { setError("Choose a program for this announcement."); return; }
    setSaving(true); setError(""); setSuccess("");
    const values = { title: draft.title.trim(), body: draft.body.trim(), audience_type: draft.audienceType, program_id: draft.audienceType === "program" ? draft.programId : null, updated_at: new Date().toISOString() };
    const result = draft.id ? await supabase.from("announcements").update(values).eq("id", draft.id) : await supabase.from("announcements").insert({ ...values, created_by: (await supabase.auth.getUser()).data.user?.id }).select().single();
    if (result.error) { setError(result.error.message); setSaving(false); return; }
    setDraft(null); setSuccess(draft.id ? "Announcement updated successfully." : "Announcement published successfully."); await load(); setSaving(false);
  }
  async function remove(a: Announcement) { if (!window.confirm(`Delete announcement "${a.title}"?`)) return; const { error: removeError } = await supabase.from("announcements").delete().eq("id", a.id); if (removeError) setError(removeError.message); else { setSuccess("Announcement deleted successfully."); await load(); } }
  function audienceLabel(a: Announcement) { if (a.audience_type === "all") return "All students"; return programs.find(p => p.id === a.program_id)?.title || "Specific program"; }

  if (loading) return <LearnShell><div className="learn-card p-6 text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={18} />Loading announcements...</div></LearnShell>;
  return <LearnShell>
    <SectionHeader eyebrow="Admin · Communication" title="Announcements" description="Share important updates with all students or link an announcement directly to a specific program." action={<button onClick={create} className="learn-primary-button"><Plus size={16} />New announcement</button>} />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {success && <div className="learn-card mb-5 border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}
    {draft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="presentation"><form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="announcement-form-title" className="learn-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><div className="learn-eyebrow">{draft.id ? "Edit announcement" : "New announcement"}</div><h2 id="announcement-form-title" className="mt-1 text-xl font-bold">{draft.id ? "Update announcement" : "Create announcement"}</h2><p className="mt-2 text-sm text-slate-400">Write the announcement and choose who should receive it.</p></div><button type="button" onClick={() => setDraft(null)} className="learn-icon-button shrink-0" disabled={saving} aria-label="Close announcement form"><X size={18}/></button></div>
      <div className="mt-6 space-y-5"><div><label className="mb-2 block text-sm font-medium">Title</label><input autoFocus value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Announcement title" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" /></div>
      <div><label className="mb-2 block text-sm font-medium">Message</label><textarea value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} rows={7} placeholder="Write your announcement..." className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" /></div>
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4"><div className="text-sm font-semibold text-white">Announcement audience</div><p className="mt-1 text-xs leading-5 text-slate-400">Send to all students or link the announcement to a specific program.</p><label className="mt-4 block text-sm text-slate-300">Audience<select value={draft.audienceType === "all" ? "all" : draft.programId} onChange={e => setAudience(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#172333] px-4 py-3 text-sm text-white"><option value="all">All students</option>{programs.map(program => <option key={program.id} value={program.id}>{program.title}</option>)}</select></label>{draft.audienceType === "program" && draft.programId && <div className="mt-3 text-xs text-cyan-300">✓ Linked to program: {programs.find(p => p.id === draft.programId)?.title || "Selected program"}</div>}</div></div>
      <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5"><button type="button" onClick={() => setDraft(null)} className="learn-secondary-button" disabled={saving}>Cancel</button><button type="submit" disabled={saving} className="learn-primary-button">{saving ? <><Loader2 size={16} className="animate-spin"/>Publishing...</> : <><Save size={16}/>{draft.id ? "Save changes" : "Publish announcement"}</>}</button></div>
    </form></div>}
    {!items.length ? <div className="learn-card p-8 text-center text-sm text-slate-400"><Megaphone className="mx-auto mb-3 text-cyan-300" size={28} />No announcements yet.</div> : <div className="space-y-4">{items.map(a => <article key={a.id} className="learn-card p-6"><div className="flex flex-col gap-4 md:flex-row md:justify-between"><div><div className="learn-eyebrow">{audienceLabel(a)}</div><h2 className="mt-2 text-xl font-bold">{a.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{a.body}</p><div className="mt-3 text-xs text-slate-500">{new Date(a.published_at).toLocaleString()}</div></div><div className="flex shrink-0 gap-2"><button onClick={() => edit(a)} className="learn-secondary-button"><Pencil size={15} />Edit</button><button onClick={() => void remove(a)} className="learn-secondary-button"><Trash2 size={15} />Delete</button></div></div></article>)}</div>}
  </LearnShell>;
}
