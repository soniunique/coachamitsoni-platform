import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, ClipboardCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Course = { id: string; title: string; slug: string; status: string };
type Module = { id: string; title: string; description: string | null; sort_order: number };

export const Route = createFileRoute("/learn/manage/courses/$courseId")({ component: CourseContentManager });

function CourseContentManager() {
  const { courseId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You are not signed in."); setLoading(false); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) { setError(profileError.message); setLoading(false); return; }
    if (profile?.role !== "admin") { setError("Only admins can manage course content."); setLoading(false); return; }
    setIsAdmin(true);
    const { data: courseData, error: courseError } = await supabase.from("courses").select("id, title, slug, status").eq("id", courseId).maybeSingle();
    if (courseError || !courseData) { setError(courseError?.message ?? "Course not found."); setLoading(false); return; }
    setCourse(courseData as Course);
    const { data: moduleData, error: moduleError } = await supabase.from("course_modules").select("id, title, description, sort_order").eq("course_id", courseId).order("sort_order", { ascending: true });
    if (moduleError) setError(moduleError.message); else setModules((moduleData ?? []) as Module[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [courseId]);

  async function addModule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) { setError("Module title is required."); return; }
    setSaving(true); setError(""); setSuccess("");
    const nextOrder = modules.length ? Math.max(...modules.map(m => m.sort_order)) + 1 : 1;
    const { error: insertError } = await supabase.from("course_modules").insert({ course_id: courseId, title: title.trim(), description: description.trim() || null, sort_order: nextOrder });
    if (insertError) setError(insertError.message); else { setTitle(""); setDescription(""); setSuccess("Module added successfully."); await load(); }
    setSaving(false);
  }

  async function deleteModule(module: Module) {
    if (!window.confirm(`Delete module "${module.title}"? Its lessons will also be removed if the database cascade is configured.`)) return;
    setError(""); setSuccess("");
    const { error: deleteError } = await supabase.from("course_modules").delete().eq("id", module.id);
    if (deleteError) setError(deleteError.message); else { setSuccess("Module deleted successfully."); await load(); }
  }

  if (loading) return <LearnShell><div className="learn-card flex items-center gap-3 p-6 text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading course content...</div></LearnShell>;
  if (!isAdmin || !course) return <LearnShell><div className="learn-card p-6"><Link to="/learn/manage/courses" className="learn-secondary-button"><ArrowLeft size={15}/>Back to Course Manager</Link><p className="mt-6 text-sm text-red-300">{error || "Course unavailable."}</p></div></LearnShell>;

  return <LearnShell>
    <div className="mb-6"><Link to="/learn/manage/courses" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15}/>Back to Course Manager</Link></div>
    <SectionHeader eyebrow="Admin · Course content" title={course.title} description="Build the course structure by adding modules. Lesson content can be managed from the dedicated content editor." />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {success && <div className="learn-card mb-5 border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}
    <div className="learn-card mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
      <div><div className="text-xs uppercase tracking-[.16em] text-slate-500">Course content</div><div className="mt-1 text-sm text-slate-300">{modules.length} module{modules.length === 1 ? "" : "s"} configured</div></div>
      <div className="flex flex-wrap gap-2"><Link to="/learn/manage/assessment/$courseId" params={{ courseId }} className="learn-secondary-button"><ClipboardCheck size={16}/>Assessment</Link><Link to="/learn/manage/course-content/$courseId" params={{ courseId }} className="learn-secondary-button">Open lesson editor</Link></div>
    </div>
    <form onSubmit={addModule} className="learn-card mb-6 space-y-5 p-6">
      <div><div className="learn-eyebrow">New module</div><h2 className="mt-1 text-xl font-bold">Add a module</h2></div>
      <div><label htmlFor="module-title" className="mb-2 block text-sm font-medium">Module title</label><input id="module-title" value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="Introduction to AI Agents" /></div>
      <div><label htmlFor="module-description" className="mb-2 block text-sm font-medium">Description <span className="text-slate-500">(optional)</span></label><textarea id="module-description" rows={3} value={description} onChange={e=>setDescription(e.target.value)} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="What students will learn in this module." /></div>
      <div className="flex justify-end"><button type="submit" className="learn-primary-button" disabled={saving}>{saving ? <><Loader2 size={17} className="animate-spin"/>Adding...</> : <><Plus size={17}/>Add module</>}</button></div>
    </form>
    <div className="space-y-4">{modules.length === 0 ? <div className="learn-card p-6 text-sm text-slate-400">No modules yet. Add the first module above.</div> : modules.map((module,index)=><article className="learn-card p-6" key={module.id}><div className="flex items-start justify-between gap-4"><div className="flex gap-4"><div className="learn-icon-tile shrink-0"><BookOpen size={19}/></div><div><div className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Module {index+1}</div><h3 className="mt-1 text-lg font-bold">{module.title}</h3>{module.description&&<p className="mt-2 text-sm text-slate-400">{module.description}</p>}</div></div><button type="button" className="learn-secondary-button" onClick={()=>void deleteModule(module)}><Trash2 size={15}/>Delete</button></div></article>)}</div>
  </LearnShell>;
}
