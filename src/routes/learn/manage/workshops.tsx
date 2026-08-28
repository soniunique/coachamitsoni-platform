import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Clock3, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Workshop = { id: string; slug: string; title: string; description: string | null; starts_at: string | null; ends_at: string | null; format: string | null; status: string; };

type Draft = { id?: string; slug: string; title: string; description: string; startsAt: string; endsAt: string; format: string; status: string };

export const Route = createFileRoute("/learn/manage/workshops")({ component: WorkshopManager });

function toInput(value: string | null) { return value ? value.slice(0, 16) : ""; }
function toIso(value: string) { return value ? new Date(value).toISOString() : null; }

function WorkshopManager() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You are not signed in."); setLoading(false); return; }
    const { data: profile, error: pe } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (pe || profile?.role !== "admin") { setError(pe?.message || "Only admins can manage workshops."); setLoading(false); return; }
    const { data, error: e } = await supabase.from("workshops").select("id,slug,title,description,starts_at,ends_at,format,status").order("starts_at", { ascending: true, nullsFirst: false });
    if (e) setError(e.message); else setWorkshops((data || []) as Workshop[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function newWorkshop() {
    setDraft({ slug: "", title: "", description: "", startsAt: "", endsAt: "", format: "Online", status: "upcoming" });
    setError(""); setSuccess("");
  }

  function editWorkshop(w: Workshop) {
    setDraft({ id: w.id, slug: w.slug, title: w.title, description: w.description || "", startsAt: toInput(w.starts_at), endsAt: toInput(w.ends_at), format: w.format || "Online", status: w.status });
    setError(""); setSuccess(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.slug.trim() || !draft.title.trim()) { setError("Workshop title and slug are required."); return; }
    if (draft.startsAt && draft.endsAt && new Date(draft.endsAt) <= new Date(draft.startsAt)) { setError("End time must be after start time."); return; }
    setSaving(true); setError(""); setSuccess("");
    const values = { slug: draft.slug.trim().toLowerCase().replace(/\s+/g, "-"), title: draft.title.trim(), description: draft.description.trim() || null, starts_at: toIso(draft.startsAt), ends_at: toIso(draft.endsAt), format: draft.format.trim() || null, status: draft.status };
    const result = draft.id ? await supabase.from("workshops").update(values).eq("id", draft.id) : await supabase.from("workshops").insert(values);
    if (result.error) { setError(result.error.message); setSaving(false); return; }
    setDraft(null); setSuccess(draft.id ? "Workshop updated successfully." : "Workshop created successfully."); await load(); setSaving(false);
  }

  async function remove(w: Workshop) {
    if (!window.confirm(`Delete workshop "${w.title}"?`)) return;
    const { error: e } = await supabase.from("workshops").delete().eq("id", w.id);
    if (e) setError(e.message); else { setSuccess("Workshop deleted successfully."); await load(); }
  }

  if (loading) return <LearnShell><div className="learn-card p-6 text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={18}/>Loading workshops...</div></LearnShell>;

  return <LearnShell>
    <SectionHeader eyebrow="Admin · Live learning" title="Workshops" description="Create and maintain the live workshops shown to students." action={<button type="button" onClick={newWorkshop} className="learn-primary-button"><Plus size={16}/>New workshop</button>} />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {success && <div className="learn-card mb-5 border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}
    {draft && <form onSubmit={save} className="learn-card mb-6 space-y-4 p-6">
      <div className="flex items-center justify-between"><div className="learn-eyebrow">{draft.id ? "Edit workshop" : "New workshop"}</div><button type="button" onClick={() => setDraft(null)} className="learn-secondary-button"><X size={15}/>Cancel</button></div>
      <div className="grid gap-4 md:grid-cols-2">
        <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" placeholder="Workshop title" />
        <input value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" placeholder="workshop-slug" />
      </div>
      <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={3} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" placeholder="Description" />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-300">Start<input type="datetime-local" value={draft.startsAt} onChange={e => setDraft({ ...draft, startsAt: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" /></label>
        <label className="text-sm text-slate-300">End<input type="datetime-local" value={draft.endsAt} onChange={e => setDraft({ ...draft, endsAt: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" /></label>
        <label className="text-sm text-slate-300">Format<select value={draft.format} onChange={e => setDraft({ ...draft, format: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"><option>Online</option><option>In person</option><option>Hybrid</option></select></label>
        <label className="text-sm text-slate-300">Status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"><option value="upcoming">Upcoming</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
      </div>
      <div className="flex justify-end"><button className="learn-primary-button" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} {saving ? "Saving..." : draft.id ? "Save changes" : "Create workshop"}</button></div>
    </form>}
    {!workshops.length ? <div className="learn-card p-8 text-center text-sm text-slate-400">No workshops yet. Create your first workshop.</div> : <div className="space-y-4">{workshops.map(w => <article key={w.id} className="learn-card p-6"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="learn-eyebrow">{w.status}</div><h2 className="mt-2 text-xl font-bold">{w.title}</h2>{w.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{w.description}</p>}<div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">{w.starts_at && <span className="learn-meta"><CalendarDays size={14}/>{new Date(w.starts_at).toLocaleString()}</span>}{w.ends_at && <span className="learn-meta"><Clock3 size={14}/>{new Date(w.ends_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}{w.format && <span className="learn-meta">{w.format}</span>}</div></div><div className="flex gap-2"><button type="button" onClick={() => editWorkshop(w)} className="learn-secondary-button"><Pencil size={15}/>Edit</button><button type="button" onClick={() => void remove(w)} className="learn-secondary-button"><Trash2 size={15}/>Delete</button></div></div></article>)}</div>}
  </LearnShell>;
}
