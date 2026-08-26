import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, CirclePlay, FileText, Link2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Course = { id: string; title: string; slug: string; status: string };
type Module = { id: string; title: string; description: string | null; sort_order: number };
type Lesson = {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  content_url: string | null;
  content_body: string | null;
  content_storage_path: string | null;
  content_type: string | null;
  sort_order: number;
  is_preview: boolean;
};

export const Route = createFileRoute("/learn/manage/course-content/$courseId")({ component: CourseContentManager });

function CourseContentManager() {
  const { courseId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lessonModuleId, setLessonModuleId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonUrl, setLessonUrl] = useState("");
  const [lessonBody, setLessonBody] = useState("");
  const [lessonType, setLessonType] = useState("video");
  const [lessonPreview, setLessonPreview] = useState(false);
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (moduleError) { setError(moduleError.message); setLoading(false); return; }
    const loadedModules = (moduleData ?? []) as Module[]; setModules(loadedModules);
    const moduleIds = loadedModules.map(module => module.id);
    if (!moduleIds.length) { setLessons([]); setLoading(false); return; }
    const { data: lessonData, error: lessonError } = await supabase.from("course_lessons").select("id, module_id, title, description, content_url, content_body, content_storage_path, content_type, sort_order, is_preview").in("module_id", moduleIds).order("sort_order", { ascending: true });
    if (lessonError) setError(lessonError.message); else setLessons((lessonData ?? []) as Lesson[]);
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

  function openLessonForm(moduleId: string) {
    setLessonModuleId(moduleId); setLessonTitle(""); setLessonDescription(""); setLessonUrl(""); setLessonBody(""); setLessonType("video"); setLessonPreview(false); setLessonFile(null); setError(""); setSuccess("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function closeLessonForm() {
    setLessonModuleId(null); setLessonTitle(""); setLessonDescription(""); setLessonUrl(""); setLessonBody(""); setLessonType("video"); setLessonPreview(false); setLessonFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function onLessonTypeChange(value: string) {
    setLessonType(value); setLessonUrl(""); setLessonBody(""); setLessonFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function addLesson(event: React.FormEvent<HTMLFormElement>, moduleId: string) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!lessonTitle.trim()) { setError("Lesson title is required."); return; }
    if (lessonType === "article" && !lessonBody.trim()) { setError("Article content is required."); return; }
    if ((lessonType === "video" || lessonType === "pdf") && !lessonFile && !lessonUrl.trim()) { setError("Choose a file or enter an external content URL."); return; }
    if (lessonType === "link" && !lessonUrl.trim()) { setError("External link URL is required."); return; }
    if (lessonFile && lessonFile.size > 1073741824) { setError("The selected file is larger than the 1 GB course-content limit."); return; }
    setSavingLesson(true);
    const moduleLessons = lessons.filter(lesson => lesson.module_id === moduleId);
    const nextOrder = moduleLessons.length ? Math.max(...moduleLessons.map(lesson => lesson.sort_order)) + 1 : 1;
    const { data: insertedLesson, error: insertError } = await supabase.from("course_lessons").insert({
      module_id: moduleId, title: lessonTitle.trim(), description: lessonDescription.trim() || null,
      content_url: lessonFile ? null : (lessonUrl.trim() || null), content_body: lessonType === "article" ? lessonBody.trim() : null,
      content_type: lessonType, sort_order: nextOrder, is_preview: lessonPreview,
    }).select("id").single();
    if (insertError || !insertedLesson) { setError(insertError?.message ?? "Could not create the lesson."); setSavingLesson(false); return; }
    if (lessonFile) {
      const safeName = lessonFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${insertedLesson.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("course-content").upload(storagePath, lessonFile, { contentType: lessonFile.type, upsert: false });
      if (uploadError) {
        await supabase.from("course_lessons").delete().eq("id", insertedLesson.id);
        setError(`Lesson was created but the file upload failed: ${uploadError.message}`); setSavingLesson(false); return;
      }
      const { error: pathError } = await supabase.from("course_lessons").update({ content_storage_path: storagePath }).eq("id", insertedLesson.id);
      if (pathError) {
        await supabase.storage.from("course-content").remove([storagePath]); await supabase.from("course_lessons").delete().eq("id", insertedLesson.id);
        setError(`The file uploaded but could not be linked to the lesson: ${pathError.message}`); setSavingLesson(false); return;
      }
    }
    setSuccess("Lesson saved successfully."); closeLessonForm(); await load(); setSavingLesson(false);
  }

  async function deleteModule(module: Module) {
    if (!window.confirm(`Delete module "${module.title}"? Its lessons will also be removed if the database cascade is configured.`)) return;
    setError(""); setSuccess(""); const { error: deleteError } = await supabase.from("course_modules").delete().eq("id", module.id);
    if (deleteError) setError(deleteError.message); else { setSuccess("Module deleted successfully."); await load(); }
  }
  async function deleteLesson(lesson: Lesson) {
    if (!window.confirm(`Delete lesson "${lesson.title}"?`)) return;
    setError(""); setSuccess(""); if (lesson.content_storage_path) await supabase.storage.from("course-content").remove([lesson.content_storage_path]);
    const { error: deleteError } = await supabase.from("course_lessons").delete().eq("id", lesson.id);
    if (deleteError) setError(deleteError.message); else { setSuccess("Lesson deleted successfully."); await load(); }
  }

  if (loading) return <LearnShell><div className="learn-card flex items-center gap-3 p-6 text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading course content...</div></LearnShell>;
  if (!isAdmin || !course) return <LearnShell><div className="learn-card p-6"><Link to="/learn/manage/courses" className="learn-secondary-button"><ArrowLeft size={15}/>Back to Course Manager</Link><p className="mt-6 text-sm text-red-300">{error || "Course unavailable."}</p></div></LearnShell>;

  return <LearnShell>
    <div className="mb-6"><Link to="/learn/manage/courses" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15}/>Back to Course Manager</Link></div>
    <SectionHeader eyebrow="Admin · Course content" title={course.title} description="Build modules and lessons. Upload course files or enter external URLs; article lessons have their own text editor." />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {success && <div className="learn-card mb-5 border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}
    <form onSubmit={addModule} className="learn-card mb-6 space-y-5 p-6">
      <div><div className="learn-eyebrow">New module</div><h2 className="mt-1 text-xl font-bold">Add a module</h2></div>
      <div><label htmlFor="module-title" className="mb-2 block text-sm font-medium">Module title</label><input id="module-title" value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="Introduction to AI Agents" /></div>
      <div><label htmlFor="module-description" className="mb-2 block text-sm font-medium">Description <span className="text-slate-500">(optional)</span></label><textarea id="module-description" rows={3} value={description} onChange={e=>setDescription(e.target.value)} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="What students will learn in this module." /></div>
      <div className="flex justify-end"><button type="submit" className="learn-primary-button" disabled={saving}>{saving ? <><Loader2 size={17} className="animate-spin"/>Adding...</> : <><Plus size={17}/>Add module</>}</button></div>
    </form>
    <div className="space-y-4">
      {modules.length === 0 ? <div className="learn-card p-6 text-sm text-slate-400">No modules yet. Add the first module above.</div> : modules.map((module,index) => {
        const moduleLessons = lessons.filter(lesson => lesson.module_id === module.id);
        return <article className="learn-card p-6" key={module.id}>
          <div className="flex items-start justify-between gap-4"><div className="flex gap-4"><div className="learn-icon-tile shrink-0"><BookOpen size={19}/></div><div><div className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Module {index+1}</div><h3 className="mt-1 text-lg font-bold">{module.title}</h3>{module.description&&<p className="mt-2 text-sm text-slate-400">{module.description}</p>}</div></div><button type="button" className="learn-secondary-button" onClick={()=>void deleteModule(module)}><Trash2 size={15}/>Delete</button></div>
          <div className="mt-5 border-t border-white/8 pt-5">
            <div className="flex items-center justify-between gap-4"><div><div className="learn-eyebrow">Module content</div><h4 className="mt-1 font-semibold">Lessons <span className="text-sm font-normal text-slate-500">({moduleLessons.length})</span></h4></div><button type="button" className="learn-primary-button" onClick={()=>openLessonForm(module.id)}><Plus size={16}/>Add lesson</button></div>
            {lessonModuleId === module.id && <form onSubmit={event=>void addLesson(event,module.id)} className="mt-5 space-y-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.03] p-5">
              <div><div className="text-sm font-semibold">New lesson</div><p className="mt-1 text-xs text-slate-500">Choose how the lesson content will be delivered.</p></div>
              <div><label htmlFor={`lesson-title-${module.id}`} className="mb-2 block text-sm font-medium">Lesson title</label><input id={`lesson-title-${module.id}`} value={lessonTitle} onChange={e=>setLessonTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="What is an AI agent?" /></div>
              <div><label htmlFor={`lesson-description-${module.id}`} className="mb-2 block text-sm font-medium">Description <span className="text-slate-500">(optional)</span></label><textarea id={`lesson-description-${module.id}`} rows={2} value={lessonDescription} onChange={e=>setLessonDescription(e.target.value)} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="Briefly describe what students will learn." /></div>
              <div><label htmlFor={`lesson-type-${module.id}`} className="mb-2 block text-sm font-medium">Content type</label><select id={`lesson-type-${module.id}`} value={lessonType} onChange={e=>onLessonTypeChange(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60"><option value="video">Video</option><option value="article">Article / text</option><option value="pdf">PDF</option><option value="link">External link</option></select></div>
              {lessonType === "article" ? <div><label htmlFor={`lesson-body-${module.id}`} className="mb-2 block text-sm font-medium">Lesson text</label><textarea id={`lesson-body-${module.id}`} rows={10} value={lessonBody} onChange={e=>setLessonBody(e.target.value)} className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-cyan-400/60" placeholder="Write the lesson content students should read..." /></div> : <>
                {(lessonType === "video" || lessonType === "pdf") && <div><label htmlFor={`lesson-file-${module.id}`} className="mb-2 block text-sm font-medium">Upload {lessonType === "video" ? "video" : "PDF"} <span className="text-slate-500">(optional if using an external URL)</span></label><input ref={fileInputRef} id={`lesson-file-${module.id}`} type="file" accept={lessonType === "video" ? "video/mp4,video/webm,video/quicktime,video/x-matroska" : "application/pdf"} onChange={e=>setLessonFile(e.target.files?.[0] ?? null)} className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white" />{lessonFile&&<p className="mt-2 text-xs text-slate-500">Selected: {lessonFile.name}</p>}</div>}
                {(lessonType === "video" || lessonType === "pdf" || lessonType === "link") && <div><label htmlFor={`lesson-url-${module.id}`} className="mb-2 block text-sm font-medium">External URL <span className="text-slate-500">(optional if uploading a file)</span></label><input id={`lesson-url-${module.id}`} type="url" value={lessonUrl} onChange={e=>setLessonUrl(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="https://..." /></div>}
              </>}
              <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={lessonPreview} onChange={e=>setLessonPreview(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5"/>Available as a student preview</label>
              <div className="flex justify-end gap-3"><button type="button" className="learn-secondary-button" onClick={closeLessonForm}>Cancel</button><button type="submit" className="learn-primary-button" disabled={savingLesson}>{savingLesson ? <><Loader2 size={16} className="animate-spin"/>Saving...</> : <><Upload size={16}/>Save lesson</>}</button></div>
            </form>}
            {moduleLessons.length === 0 ? <p className="mt-5 text-sm text-slate-500">No lessons yet. Use <strong className="text-slate-300">Add lesson</strong> to start building this module.</p> : <div className="mt-5 space-y-2">{moduleLessons.map((lesson,lessonIndex)=><div key={lesson.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.03] p-3"><div className="learn-icon-tile shrink-0">{lesson.content_type === "video" ? <CirclePlay size={17}/> : lesson.content_type === "link" ? <Link2 size={17}/> : <FileText size={17}/>}</div><div className="min-w-0 flex-1"><div className="text-xs text-slate-500">Lesson {lessonIndex+1}{lesson.is_preview ? " · Preview" : ""}</div><div className="text-sm font-medium text-slate-200">{lesson.title}</div>{lesson.description&&<div className="truncate text-xs text-slate-500">{lesson.description}</div>}</div><span className="hidden text-xs text-slate-500 sm:inline">{lesson.content_type || "content"}</span><button type="button" className="learn-secondary-button" onClick={()=>void deleteLesson(lesson)}><Trash2 size={14}/>Delete</button></div>)}</div>}
          </div>
        </article>;
      })}
    </div>
  </LearnShell>;
}
