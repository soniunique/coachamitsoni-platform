import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Layers, Loader2, Pencil, Plus, Trash2, X, BarChart3, ClipboardCheck, Save, CheckCircle2, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Status = "draft" | "published" | "archived";
type Program = { id: string; slug: string; title: string; description: string | null; status: Status; sort_order: number };
type Course = { id: string; slug: string; title: string; description: string | null; thumbnail_url: string | null; status: Status; program_id: string };
type CourseReadiness = { modules: number; lessons: number; assessmentExists: boolean; assessmentRequired: boolean };

const emptyProgram = { slug: "", title: "", description: "", status: "draft" as Status, sort_order: 0 };
const emptyCourse = { slug: "", title: "", description: "", thumbnail_url: "", status: "draft" as Status, program_id: "" };

export const Route = createFileRoute("/learn/manage/courses")({ component: CourseManager });

function CourseManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [readiness, setReadiness] = useState<Record<string, CourseReadiness>>({});
  const [programFormOpen, setProgramFormOpen] = useState(false);
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [programForm, setProgramForm] = useState(emptyProgram);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { setError(userError?.message ?? "You are not signed in."); setLoading(false); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) { setError(profileError.message); setLoading(false); return; }
    const admin = profile?.role === "admin"; setIsAdmin(admin);
    if (!admin) { setError("Only admins can manage programs and courses."); setLoading(false); return; }
    const [{ data: programData, error: programError }, { data: courseData, error: courseError }] = await Promise.all([
      supabase.from("programs").select("id, slug, title, description, status, sort_order").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      supabase.from("courses").select("id, slug, title, description, thumbnail_url, status, program_id").order("created_at", { ascending: false }),
    ]);
    if (programError) { setError(programError.message); setLoading(false); return; }
    if (courseError) { setError(courseError.message); setLoading(false); return; }
    const loadedCourses = (courseData ?? []) as Course[];
    setPrograms((programData ?? []) as Program[]); setCourses(loadedCourses);

    const nextReadiness: Record<string, CourseReadiness> = {};
    const courseIds = loadedCourses.map(course => course.id);
    if (courseIds.length) {
      const [{ data: moduleData, error: moduleError }, { data: assessmentData, error: assessmentError }] = await Promise.all([
        supabase.from("course_modules").select("id, course_id").in("course_id", courseIds),
        supabase.from("course_assessments").select("course_id, require_completion").in("course_id", courseIds),
      ]);
      if (moduleError) { setError(moduleError.message); setLoading(false); return; }
      if (assessmentError) { setError(assessmentError.message); setLoading(false); return; }
      const modules = moduleData ?? [];
      const moduleIds = modules.map(module => module.id);
      const { data: lessonData, error: lessonError } = moduleIds.length
        ? await supabase.from("course_lessons").select("id, module_id").in("module_id", moduleIds)
        : { data: [], error: null };
      if (lessonError) { setError(lessonError.message); setLoading(false); return; }
      const moduleCourse = new Map(modules.map(module => [module.id, module.course_id]));
      const assessmentByCourse = new Map((assessmentData ?? []).map(assessment => [assessment.course_id, assessment]));
      for (const course of loadedCourses) {
        const moduleCount = modules.filter(module => module.course_id === course.id).length;
        const lessonCount = (lessonData ?? []).filter(lesson => moduleCourse.get(lesson.module_id) === course.id).length;
        const assessment = assessmentByCourse.get(course.id);
        nextReadiness[course.id] = { modules: moduleCount, lessons: lessonCount, assessmentExists: Boolean(assessment), assessmentRequired: Boolean(assessment?.require_completion) };
      }
    }
    setReadiness(nextReadiness); setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!courseFormOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [courseFormOpen]);

  function openCreateProgram() { setEditingProgramId(null); setProgramForm(emptyProgram); setError(""); setSuccess(""); setProgramFormOpen(true); }
  function openEditProgram(program: Program) { setEditingProgramId(program.id); setProgramForm({ slug: program.slug, title: program.title, description: program.description ?? "", status: program.status, sort_order: program.sort_order }); setError(""); setSuccess(""); setProgramFormOpen(true); }
  function openCreateCourse(programId = "") { setEditingCourseId(null); setCourseForm({ ...emptyCourse, program_id: programId || programs[0]?.id || "" }); setError(""); setSuccess(""); setCourseFormOpen(true); }
  function openEditCourse(course: Course) { setEditingCourseId(course.id); setCourseForm({ slug: course.slug, title: course.title, description: course.description ?? "", thumbnail_url: course.thumbnail_url ?? "", status: course.status, program_id: course.program_id }); setError(""); setSuccess(""); setCourseFormOpen(true); }
  function closeForms() { setProgramFormOpen(false); setCourseFormOpen(false); setEditingProgramId(null); setEditingCourseId(null); setProgramForm(emptyProgram); setCourseForm(emptyCourse); }

  async function saveProgram(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const payload = { slug: programForm.slug.trim(), title: programForm.title.trim(), description: programForm.description.trim() || null, status: programForm.status, sort_order: Number(programForm.sort_order) || 0 };
    if (!payload.slug || !payload.title) { setError("Program slug and title are required."); setSaving(false); return; }
    const result = editingProgramId ? await supabase.from("programs").update(payload).eq("id", editingProgramId) : await supabase.from("programs").insert(payload);
    if (result.error) { setError(result.error.message); setSaving(false); return; }
    closeForms(); setSuccess(editingProgramId ? "Program updated successfully." : "Program created successfully."); setSaving(false); await load();
  }

  async function deleteProgram(program: Program) {
    const count = courses.filter(c => c.program_id === program.id).length;
    if (count > 0) { setError(`Cannot delete "${program.title}" while it contains ${count} course${count === 1 ? "" : "s"}. Move or delete the courses first.`); return; }
    if (!window.confirm(`Delete program "${program.title}"?`)) return;
    const { error: deleteError } = await supabase.from("programs").delete().eq("id", program.id);
    if (deleteError) { setError(deleteError.message); return; }
    setSuccess("Program deleted successfully."); await load();
  }

  async function saveCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const payload = { slug: courseForm.slug.trim(), title: courseForm.title.trim(), description: courseForm.description.trim() || null, thumbnail_url: courseForm.thumbnail_url.trim() || null, status: courseForm.status, program_id: courseForm.program_id };
    if (!payload.slug || !payload.title || !payload.program_id) { setError("Program, course slug and title are required."); setSaving(false); return; }
    const result = editingCourseId ? await supabase.from("courses").update(payload).eq("id", editingCourseId) : await supabase.from("courses").insert(payload);
    if (result.error) { setError(result.error.message); setSaving(false); return; }
    closeForms(); setSuccess(editingCourseId ? "Course updated successfully." : "Course created successfully."); setSaving(false); await load();
  }

  async function deleteCourse(course: Course) {
    if (!window.confirm(`Delete "${course.title}"? This will also delete its modules and lessons.`)) return;
    const { error: deleteError } = await supabase.from("courses").delete().eq("id", course.id);
    if (deleteError) { setError(deleteError.message); return; }
    setSuccess("Course deleted successfully."); await load();
  }

  const coursesFor = (programId: string) => courses.filter(course => course.program_id === programId);
  const courseIsReady = (course: Course) => { const r = readiness[course.id]; return Boolean(r && r.modules > 0 && r.lessons > 0 && (!r.assessmentRequired || r.assessmentExists)); };

  return <LearnShell>
    <SectionHeader eyebrow="Admin" title="Programs & Courses" description="Programs contain courses. Student access is granted at the program level and automatically covers every course inside it." action={isAdmin ? <div><button type="button" className="learn-secondary-button" onClick={openCreateProgram}><Plus size={17}/>New program</button></div> : undefined} />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {success && <div className="learn-card mb-5 border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}
    {isAdmin && programFormOpen && <form onSubmit={saveProgram} className="learn-card mb-6 space-y-5 p-6"><div className="flex items-center justify-between"><div><div className="learn-eyebrow">{editingProgramId ? "Edit program" : "New program"}</div><h2 className="mt-1 text-xl font-bold">{editingProgramId ? "Update program" : "Create program"}</h2></div><button type="button" className="learn-icon-button" onClick={closeForms}><X size={18}/></button></div><div className="grid gap-5 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium">Program title</label><input value={programForm.title} onChange={e=>setProgramForm(p=>({...p,title:e.target.value}))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="Program A"/></div><div><label className="mb-2 block text-sm font-medium">Slug</label><input value={programForm.slug} onChange={e=>setProgramForm(p=>({...p,slug:e.target.value.toLowerCase().replace(/\s+/g,"-")}))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="program-a"/></div></div><div><label className="mb-2 block text-sm font-medium">Description</label><textarea rows={3} value={programForm.description} onChange={e=>setProgramForm(p=>({...p,description:e.target.value}))} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60"/></div><div className="grid gap-5 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium">Status</label><select value={programForm.status} onChange={e=>setProgramForm(p=>({...p,status:e.target.value as Status}))} className="w-full rounded-xl border border-white/10 bg-[#111d2d] px-4 py-3 text-sm text-white"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div><div><label className="mb-2 block text-sm font-medium">Display order</label><input type="number" value={programForm.sort_order} onChange={e=>setProgramForm(p=>({...p,sort_order:Number(e.target.value)}))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"/></div></div><div className="flex justify-end gap-3"><button type="button" className="learn-secondary-button" onClick={closeForms}>Cancel</button><button type="submit" className="learn-primary-button" disabled={saving}>{saving?<><Loader2 size={17} className="animate-spin"/>Saving...</>:<><Save size={17}/>Save program</>}</button></div></form>}
    {isAdmin && courseFormOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="presentation"><form onSubmit={saveCourse} role="dialog" aria-modal="true" aria-labelledby="course-form-title" className="learn-card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><div className="learn-eyebrow">{editingCourseId ? "Edit course" : "New course"}</div><h2 id="course-form-title" className="mt-1 text-xl font-bold">{editingCourseId ? "Update course" : "Create course inside a program"}</h2><p className="mt-2 text-sm text-slate-400">Set up the course without leaving the program you are managing.</p></div><button type="button" className="learn-icon-button shrink-0" onClick={closeForms} disabled={saving} aria-label="Close course form"><X size={18}/></button></div><div className="mt-6 space-y-5"><div><label className="mb-2 block text-sm font-medium">Program <span className="text-cyan-300">*</span></label><select value={courseForm.program_id} onChange={e=>setCourseForm(c=>({...c,program_id:e.target.value}))} className="w-full rounded-xl border border-white/10 bg-[#111d2d] px-4 py-3 text-sm text-white"><option value="">Select a program</option>{programs.map(program=><option key={program.id} value={program.id}>{program.title}</option>)}</select><p className="mt-2 text-xs text-slate-500">Students assigned to this program automatically receive access to this course.</p></div><div className="grid gap-5 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium">Course title</label><input autoFocus value={courseForm.title} onChange={e=>setCourseForm(c=>({...c,title:e.target.value}))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" placeholder="Build Your First AI Agent"/></div><div><label className="mb-2 block text-sm font-medium">Slug</label><input value={courseForm.slug} onChange={e=>setCourseForm(c=>({...c,slug:e.target.value.toLowerCase().replace(/\s+/g,"-")}))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" placeholder="build-your-first-ai-agent"/></div></div><div><label className="mb-2 block text-sm font-medium">Description</label><textarea rows={4} value={courseForm.description} onChange={e=>setCourseForm(c=>({...c,description:e.target.value}))} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"/></div><div className="grid gap-5 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium">Thumbnail URL</label><input type="url" value={courseForm.thumbnail_url} onChange={e=>setCourseForm(c=>({...c,thumbnail_url:e.target.value}))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"/></div><div><label className="mb-2 block text-sm font-medium">Status</label><select value={courseForm.status} onChange={e=>setCourseForm(c=>({...c,status:e.target.value as Status}))} className="w-full rounded-xl border border-white/10 bg-[#111d2d] px-4 py-3 text-sm text-white"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div></div></div><div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5"><button type="button" className="learn-secondary-button" onClick={closeForms} disabled={saving}>Cancel</button><button type="submit" className="learn-primary-button" disabled={saving}>{saving?<><Loader2 size={17} className="animate-spin"/>Saving...</>:<><Save size={17}/>Save course</>}</button></div></form></div>}
    {loading ? <div className="learn-card flex items-center gap-3 p-6 text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading programs and courses...</div> : isAdmin && <div className="space-y-6">{programs.length === 0 ? <div className="learn-card p-8 text-center"><BookOpen className="mx-auto text-cyan-300" size={32}/><h2 className="mt-4 text-lg font-bold">No programs yet</h2><p className="mt-2 text-sm text-slate-400">Create a program first, then add courses inside it.</p></div> : programs.map(program => <section key={program.id} className="learn-card overflow-hidden"><div className="border-b border-white/10 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-3"><h2 className="text-xl font-bold">{program.title}</h2><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{program.status}</span></div><p className="mt-1 text-xs text-slate-500">{program.slug} · {coursesFor(program.id).length} course{coursesFor(program.id).length === 1 ? "" : "s"}</p><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{program.description || "No description added yet."}</p></div><div className="flex gap-2"><button type="button" className="learn-secondary-button" onClick={()=>openEditProgram(program)}><Pencil size={15}/>Edit program</button><button type="button" className="learn-primary-button" onClick={() => openCreateCourse(program.id)}><Plus size={15}/>Add course</button><button type="button" className="learn-icon-button" onClick={()=>void deleteProgram(program)} aria-label={`Delete ${program.title}`}><Trash2 size={16}/></button></div></div></div><div className="p-6">{coursesFor(program.id).length === 0 ? <p className="text-sm text-slate-500">No courses in this program yet.</p> : <div className="grid gap-4 md:grid-cols-2">{coursesFor(program.id).map(course=>{const r=readiness[course.id];const ready=courseIsReady(course);return <article key={course.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{course.title}</h3><p className="mt-1 text-xs text-slate-500">{course.slug}</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{course.status}</span></div><div className={`mt-4 rounded-xl border px-3 py-3 ${ready?"border-emerald-400/20 bg-emerald-400/5":"border-amber-400/20 bg-amber-400/5"}`}><div className={`flex items-center gap-2 text-sm font-semibold ${ready?"text-emerald-300":"text-amber-300"}`}>{ready?<CheckCircle2 size={16}/>:<CircleAlert size={16}/>}<span>{ready?"Ready to publish":"Needs attention"}</span></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400"><span>{r?.modules ?? 0} module{(r?.modules ?? 0)===1?"":"s"}</span><span>{r?.lessons ?? 0} lesson{(r?.lessons ?? 0)===1?"":"s"}</span><span>{r?.assessmentExists?`Assessment${r.assessmentRequired?" · required":" · optional"}`:"No assessment"}</span></div>{!ready&&<p className="mt-2 text-xs text-amber-200/80">{(r?.modules??0)===0?"Add at least one module. ":""}{(r?.lessons??0)===0?"Add at least one lesson. ":""}{r?.assessmentRequired&&!r?.assessmentExists?"Create the required assessment.":""}</p>}</div><p className="mt-3 text-sm leading-6 text-slate-400">{course.description || "No description added yet."}</p><div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4"><button type="button" className="learn-secondary-button" onClick={()=>openEditCourse(course)}><Pencil size={15}/>Edit</button><Link to="/learn/manage/course-content/$courseId" params={{courseId: course.id}} className="learn-secondary-button"><Layers size={15}/>Content</Link><Link to="/learn/manage/assessment/$courseId" params={{courseId: course.id}} className="learn-secondary-button"><ClipboardCheck size={15}/>Assessment</Link><Link to="/learn/manage/course-students/$courseId" params={{courseId: course.id}} className="learn-secondary-button"><BarChart3 size={15}/>Progress</Link></div><div className="mt-2 flex justify-end"><button type="button" className="learn-icon-button" onClick={()=>void deleteCourse(course)} aria-label={`Delete ${course.title}`}><Trash2 size={16}/></button></div></article>})}</div>}</div></section>)}</div>}
  </LearnShell>;
}
