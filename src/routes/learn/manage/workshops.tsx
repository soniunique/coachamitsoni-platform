import { createFileRoute } from "@tanstack/react-router";
import { Edit3, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/manage/workshops")({ component: ManageWorkshops });

type Workshop = { id: string; slug: string; title: string; description: string | null; starts_at: string | null; ends_at: string | null; format: string | null; status: string; meeting_url: string | null };
type Form = { slug: string; title: string; description: string; starts_at: string; ends_at: string; format: string; status: string; meeting_url: string };
const emptyForm: Form = { slug: "", title: "", description: "", starts_at: "", ends_at: "", format: "Online", status: "upcoming", meeting_url: "" };

function toInput(value: string | null) { return value ? value.slice(0, 16) : ""; }
function toIso(value: string) { return value ? new Date(value).toISOString() : null; }

function ManageWorkshops() {
  const [items, setItems] = useState<Workshop[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Please sign in as an administrator."); setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") { setError("Administrator access is required."); setLoading(false); return; }
    const { data, error: loadError } = await supabase.from("workshops").select("id,slug,title,description,starts_at,ends_at,format,status,meeting_url").order("starts_at", { ascending: true });
    if (loadError) setError(loadError.message); else setItems((data ?? []) as Workshop[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function edit(item: Workshop) { setEditingId(item.id); setForm({ slug: item.slug, title: item.title, description: item.description ?? "", starts_at: toInput(item.starts_at), ends_at: toInput(item.ends_at), format: item.format ?? "Online", status: item.status, meeting_url: item.meeting_url ?? "" }); setNotice(""); }
  function reset() { setEditingId(null); setForm(emptyForm); setNotice(""); }

  async function save() {
    if (!form.title.trim() || !form.slug.trim()) { setError("Title and slug are required."); return; }
    setSaving(true); setError(""); setNotice("");
    const payload = { slug: form.slug.trim(), title: form.title.trim(), description: form.description.trim() || null, starts_at: toIso(form.starts_at), ends_at: toIso(form.ends_at), format: form.format.trim() || "Online", status: form.status, meeting_url: form.meeting_url.trim() || null };
    const result = editingId ? await supabase.from("workshops").update(payload).eq("id", editingId) : await supabase.from("workshops").insert(payload);
    if (result.error) setError(result.error.message); else { setNotice(editingId ? "Workshop updated." : "Workshop created."); reset(); await load(); }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this workshop?")) return;
    const { error: deleteError } = await supabase.from("workshops").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else { setNotice("Workshop deleted."); await load(); }
  }

  return <LearnShell>
    <SectionHeader eyebrow="Admin" title="Workshop Manager" description="Create upcoming workshops, publish dates and add the Zoom joining link students will see." action={<button type="button" className="learn-primary-button" onClick={reset}><Plus size={15}/> New workshop</button>} />
    {error && <div className="learn-alert error mb-5">{error}</div>}{notice && <div className="learn-alert success mb-5">{notice}</div>}
    {(editingId || form.title) && <section className="reference-admin-form mb-5"><h2 className="text-lg font-bold">{editingId ? "Edit workshop" : "New workshop"}</h2><div className="reference-admin-form-grid mt-4"><div className="reference-admin-field"><label>Title</label><input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="AI Agents from Scratch"/></div><div className="reference-admin-field"><label>Slug</label><input value={form.slug} onChange={(e)=>setForm({...form,slug:e.target.value})} placeholder="ai-agents-from-scratch"/></div><div className="reference-admin-field full"><label>Description</label><textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} placeholder="Workshop description shown to students"/></div><div className="reference-admin-field"><label>Start</label><input type="datetime-local" value={form.starts_at} onChange={(e)=>setForm({...form,starts_at:e.target.value})}/></div><div className="reference-admin-field"><label>End</label><input type="datetime-local" value={form.ends_at} onChange={(e)=>setForm({...form,ends_at:e.target.value})}/></div><div className="reference-admin-field"><label>Format</label><input value={form.format} onChange={(e)=>setForm({...form,format:e.target.value})} placeholder="Online"/></div><div className="reference-admin-field"><label>Status</label><select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="upcoming">Upcoming</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div><div className="reference-admin-field full"><label>Zoom meeting link</label><input type="url" value={form.meeting_url} onChange={(e)=>setForm({...form,meeting_url:e.target.value})} placeholder="https://zoom.us/j/..."/></div></div><div className="reference-admin-actions"><button type="button" className="learn-secondary-button" onClick={reset}>Cancel</button><button type="button" className="learn-primary-button" onClick={()=>void save()} disabled={saving}><Save size={15}/>{saving ? "Saving…" : "Save workshop"}</button></div></section>}
    {loading ? <div className="learn-card p-8 text-sm">Loading workshops...</div> : <div className="overflow-hidden rounded-[10px]"><table className="reference-admin-table"><thead><tr><th>Workshop</th><th>Date</th><th>Status</th><th>Zoom</th><th>Actions</th></tr></thead><tbody>{items.map((item)=><tr key={item.id}><td><strong>{item.title}</strong><div className="mt-1 text-[10px] text-slate-500">{item.slug}</div></td><td>{item.starts_at ? new Date(item.starts_at).toLocaleString() : "—"}</td><td>{item.status}</td><td>{item.meeting_url ? "Configured" : "Not set"}</td><td><div className="reference-admin-inline-actions"><button type="button" onClick={()=>edit(item)}><Edit3 size={11}/> Edit</button><button type="button" onClick={()=>void remove(item.id)}><Trash2 size={11}/> Delete</button></div></td></tr>)}{items.length===0&&<tr><td colSpan={5}>No workshops created yet.</td></tr>}</tbody></table></div>}
  </LearnShell>;
}
