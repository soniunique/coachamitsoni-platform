import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, CheckCircle2, CirclePlay, ExternalLink, FileText, Link2, Loader2, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
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
type LessonDraft = { id?: string; moduleId: string; title: string; description: string; url: string; body: string; type: string; preview: boolean; file: File | null; existingStoragePath: string | null };

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
  const [lessonDraft, setLessonDraft] = useState<LessonDraft | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
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
  function resetFileInput() { if (fileInputRef.current) fileInputRef.current.value = ""; }
  function updateDraft(patch: Partial<LessonDraft>) { setLessonDraft(current => current ? { ...current, ...patch } : current); }
  function openNewLessonForm(moduleId: string) { setLessonDraft({ moduleId, title: "", description: "", url: "", body: "", type: "video", preview: false, file: null, existingStoragePath: null }); setError(""); setSuccess(""); resetFileInput(); }
  function openEditLessonForm(lesson: Lesson) { setLessonDraft({ id: lesson.id, moduleId: lesson.module_id, title: lesson.title, description: lesson.description ?? "", url: lesson.content_url ?? "", body: lesson.content_body ?? "", type: lesson.content_type ?? "video", preview: lesson.is_preview, file: null, existingStoragePath: lesson.content_storage_path }); setError(""); setSuccess(""); resetFileInput(); }
  function closeLessonForm() { setLessonDraft(null); resetFileInput(); }
  function setLessonType(value: string) { if (!lessonDraft) return; setLessonDraft({ ...lessonDraft, type: value, url: "", body: "", file: null }); resetFileInput(); }

  async function addModule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!title.trim()) { setError("Module title is required."); return; }
    setSaving(true); setError(""); setSuccess("");
    const nextOrder = modules.length ? Math.max(...modules.map(m => m.sort_order)) + 1 : 1;
    const { error: insertError } = await supabase.from("course_modules").insert({ course_id: courseId, title: title.trim(), description: description.trim() || null, sort_order: nextOrder });
    if (insertError) setError(insertError.message); else { setTitle(""); setDescription(""); setSuccess("Module added successfully."); await load(); }
    setSaving(false);
  }

  async function saveLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!lessonDraft) return; setError(""); setSuccess("");
    if (!lessonDraft.title.trim()) { setError("Lesson title is required."); return; }
    if (lessonDraft.type === "article" && !lessonDraft.body.trim()) { setError("Article content is required."); return; }
    if ((lessonDraft.type === "video" || lessonDraft.type === "pdf") && !lessonDraft.file && !lessonDraft.url.trim() && !lessonDraft.existingStoragePath) { setError("Choose a file or enter an external content URL."); return; }
    if (lessonDraft.type === "link" && !lessonDraft.url.trim()) { setError("External link URL is required."); return; }
    if (lessonDraft.file && lessonDraft.file.size > 1073741824) { setError("The selected file is larger than the 1 GB course-content limit."); return; }
    setSavingLesson(true);
    const existing = lessonDraft.id ? lessons.find(lesson => lesson.id === lessonDraft.id) : null;
    const moduleLessons = lessons.filter(lesson => lesson.module_id === lessonDraft.moduleId);
    const nextOrder = moduleLessons.length ? Math.max(...moduleLessons.map(lesson => lesson.sort_order)) + 1 : 1;
    let storagePath = existing?.content_storage_path ?? null;
    const oldStoragePath = existing?.content_storage_path ?? null;

    if (lessonDraft.file) {
      const safeName = lessonDraft.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const targetId = lessonDraft.id ?? crypto.randomUUID();
      storagePath = `${targetId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("course-content").upload(storagePath, lessonDraft.file, { contentType: lessonDraft.file.type, upsert: false });
      if (uploadError) { setError(`The file upload failed: ${uploadError.message}`); setSavingLesson(false); return; }
    } else if (lessonDraft.type === "article" || lessonDraft.type === "link" || lessonDraft.url.trim()) storagePath = null;

    const values = {
      module_id: lessonDraft.moduleId,
      title: lessonDraft.title.trim(),
      description: lessonDraft.description.trim() || null,
      content_url: lessonDraft.file ? null : (lessonDraft.type === "article" ? null : (lessonDraft.url.trim() || null)),
      content_body: lessonDraft.type === "article" ? lessonDraft.body.trim() : null,
      content_storage_path: storagePath,
      content_type: lessonDraft.type,
      sort_order: existing?.sort_order ?? nextOrder,
      is_preview: lessonDraft.preview,
    };

    if (lessonDraft.id) {
      const { error: updateError } = await supabase.from("course_lessons").update(values).eq("id", lessonDraft.id);
      if (updateError) { if (lessonDraft.file && storagePath) await supabase.storage.from("course-content").remove([storagePath]); setError(`Could not update lesson: ${updateError.message}`); setSavingLesson(false); return; }
    } else {
      const { data: insertedLesson, error: insertError } = await supabase.from("course_lessons").insert(values).select("id").single();
      if (insertError || !insertedLesson) { if (lessonDraft.file && storagePath) await supabase.storage.from("course-content").remove([storagePath]); setError(insertError?.message ?? "Could not create the lesson."); setSavingLesson(false); return; }
    }
    if (oldStoragePath && oldStoragePath !== storagePath) await supabase.storage.from("course-content").remove([oldStoragePath]);
    setSuccess(lessonDraft.id ? "Lesson updated successfully." : "Lesson saved successfully."); closeLessonForm(); await load(); setSavingLesson(false);
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
  async function preview(lesson: Lesson) {
    setPreviewLesson(lesson); setPreviewUrl(null); setLoadingPreview(true); setError("");
    if (lesson.content_storage_path) { const { data, error: signedError } = await supabase.storage.from("course-content").createSignedUrl(lesson.content_storage_path, 3600); if (signedError) setError(signedError.message); else setPreviewUrl(data?.signedUrl ?? null); }
    else setPreviewUrl(lesson.content_url);
    setLoadingPreview(false);
  }
  function closePreview() { setPreviewLesson(null); setPreviewUrl(null); }
  function youtubeEmbed(url: string | null) { if (!url) return null; try { const parsed = new URL(url); if (parsed.hostname.includes("youtube.com")) { const id = parsed.searchParams.get("v"); return id ? `https://www.youtube.com/embed/${id}` : null; } if (parsed.hostname === "youtu.be") return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`; } catch { return null; } return null; }

  if (loading) return <LearnShell><div className="learn-card flex items-center gap-3 p-6 text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading course content...</div></LearnShell>;
  if (!isAdmin || !course) return <LearnShell><div className="learn-card p-6"><Link to="/learn/manage/courses" className="learn-secondary-button"><ArrowLeft size={15}/>Back to Course Manager</Link><p className="mt-6 text-sm text-red-300">{error || "Course unavailable."}</p></div></LearnShell>;

  return <LearnShell>
    <div className="mb-6"><Link to="/learn/manage/courses" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15}/>Back to Course Manager</Link></div>
    <SectionHeader eyebrow="Admin · Course content" title={course.title} description="Build, preview and maintain course content. Every saved lesson can be previewed and edited from this page." />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {success && <div className="learn-card mb-5 border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}
    <form onSubmit={addModule} className="learn-card mb-6 space-y-5 p-6"><div><div className="learn-eyebrow">New module</div><h2 className="mt-1 text-xl font-bold">Add a module</h2></div><div><label htmlFor="module-title" className="mb-2 block text-sm font-medium">Module title</label><input id="module-title" value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="Introduction to AI Agents" /></div><div><label htmlFor="module-description" className="mb-2 block text-sm font-medium">Description <span className="text-slate-500">(optional)</span></label><textarea id="module-description" rows={3} value={description} onChange={e=>setDescription(e.target.value)} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="What students will learn in this module." /></div><div className="flex justify-end"><button type="submit" className="learn-primary-button" disabled={saving}>{saving ? <><Loader2 size={17} className="animate-spin"/>Adding...</> : <><Plus size={17}/>Add module</>}</button></div></form>
    <div className="space-y-4">
      {modules.length === 0 ? <div className="learn-card p-6 text-sm text-slate-400">No modules yet. Add the first module above.</div> : modules.map((module,index) => {
        const moduleLessons = lessons.filter(lesson => lesson.module_id === module.id);
        const editingThisModule = lessonDraft?.moduleId === module.id;
        return <article className="learn-card p-6" key={module.id}>
          <div className="flex items-start justify-between gap-4"><div className="flex gap-4"><div className="learn-icon-tile shrink-0"><BookOpen size={19}/></div><div><div className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Module {index+1}</div><h3 className="mt-1 text-lg font-bold">{module.title}</h3>{module.description&&<p className="mt-2 text-sm text-slate-400">{module.description}</p>}</div></div><button type="button" className="learn-secondary-button" onClick={()=>void deleteModule(module)}><Trash2 size={15}/>Delete</button></div>
          <div className="mt-5 border-t border-white/8 pt-5">
            <div className="flex items-center justify-between gap-4"><div><div className="learn-eyebrow">Module content</div><h4 className="mt-1 font-semibold">Lessons <span className="text-sm font-normal text-slate-500">({moduleLessons.length})</span></h4></div><button type="button" className="learn-primary-button" onClick={()=>openNewLessonForm(module.id)}><Plus size={16}/>Add lesson</button></div>
            {editingThisModule && <form onSubmit={saveLesson} className="mt-5 space-y-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.03] p-5"><div><div className="learn-eyebrow">{lessonDraft?.id ? "Edit lesson" : "New lesson"}</div><h5 className="mt-1 text-lg font-semibold">{lessonDraft?.id ? "Update lesson content" : "Create lesson content"}</h5><p className="mt-1 text-xs text-slate-500">Save once, then use Preview or Edit from the lesson card whenever you need to maintain it.</p></div><div><label htmlFor={`lesson-title-${module.id}`} className="mb-2 block text-sm font-medium">Lesson title</label><input id={`lesson-title-${module.id}`} value={lessonDraft?.title ?? ""} onChange={e=>updateDraft({title:e.target.value})} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="What is an AI agent?" /></div><div><label htmlFor={`lesson-description-${module.id}`} className="mb-2 block text-sm font-medium">Description <span className="text-slate-500">(optional)</span></label><textarea id={`lesson-description-${module.id}`} rows={2} value={lessonDraft?.description ?? ""} onChange={e=>updateDraft({description:e.target.value})} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="Briefly describe what students will learn." /></div><div><label htmlFor={`lesson-type-${module.id}`} className="mb-2 block text-sm font-medium">Content type</label><select id={`lesson-type-${module.id}`} value={lessonDraft?.type ?? "video"} onChange={e=>setLessonType(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60"><option value="video">Video</option><option value="article">Article / text</option><option value="pdf">PDF</option><option value="link">External link</option></select></div>{lessonDraft?.type === "article" ? <div><label htmlFor={`lesson-body-${module.id}`} className="mb-2 block text-sm font-medium">Lesson text</label><textarea id={`lesson-body-${module.id}`} rows={12} value={lessonDraft.body} onChange={e=>updateDraft({body:e.target.value})} className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-cyan-400/60" placeholder="Write the lesson content students should read..." /><p className="mt-2 text-xs text-slate-500">Plain text is supported in this authoring release; formatting can be added later without changing the lesson model.</p></div> : <>{(lessonDraft?.type === "video" || lessonDraft?.type === "pdf") && <div><label htmlFor={`lesson-file-${module.id}`} className="mb-2 block text-sm font-medium">{lessonDraft?.id && lessonDraft.existingStoragePath ? "Replace file" : "Upload file"}</label>{lessonDraft?.existingStoragePath && !lessonDraft.file && <p className="mb-2 text-xs text-emerald-300">Existing uploaded file is active. Choose a new file only if you want to replace it.</p>}<input ref={fileInputRef} id={`lesson-file-${module.id}`} type="file" accept={lessonDraft?.type === "video" ? "video/mp4,video/webm,video/quicktime,video/x-matroska" : "application/pdf"} onChange={e=>updateDraft({file:e.target.files?.[0] ?? null})} className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white" />{lessonDraft?.file&&<p className="mt-2 text-xs text-slate-500">Selected: {lessonDraft.file.name}</p>}</div>}{(lessonDraft?.type === "video" || lessonDraft?.type === "pdf" || lessonDraft?.type === "link") && <div><label htmlFor={`lesson-url-${module.id}`} className="mb-2 block text-sm font-medium">External URL <span className="text-slate-500">(optional when using a file)</span></label><input id={`lesson-url-${module.id}`} type="url" value={lessonDraft?.url ?? ""} onChange={e=>updateDraft({url:e.target.value})} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="https://..." /></div>}</>}
            <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={lessonDraft?.preview ?? false} onChange={e=>updateDraft({preview:e.target.checked})} className="h-4 w-4 rounded border-white/20 bg-white/5"/>Available as a student preview</label><div className="flex justify-end gap-3"><button type="button" className="learn-secondary-button" onClick={closeLessonForm}>Cancel</button><button type="submit" className="learn-primary-button" disabled={savingLesson}>{savingLesson ? <><Loader2 size={16} className="animate-spin"/>Saving...</> : <><Save size={16}/>{lessonDraft?.id ? "Save changes" : "Save lesson"}</>}</button></div></form>}
            {moduleLessons.length === 0 ? <p className="mt-5 text-sm text-slate-500">No lessons yet. Use <strong className="text-slate-300">Add lesson</strong> to start building this module.</p> : <div className="mt-5 space-y-3">{moduleLessons.map((lesson,lessonIndex)=><div key={lesson.id} className="rounded-xl border border-white/8 bg-white/[.03] p-3"><div className="flex items-center gap-3"><div className="learn-icon-tile shrink-0">{lesson.content_type === "video" ? <CirclePlay size={17}/> : lesson.content_type === "link" ? <Link2 size={17}/> : <FileText size={17}/>}</div><div className="min-w-0 flex-1"><div className="text-xs text-slate-500">Lesson {lessonIndex+1} · {lesson.content_type || "content"}{lesson.is_preview ? " · Student preview" : " · Restricted"}</div><div className="text-sm font-medium text-slate-200">{lesson.title}</div>{lesson.description&&<div className="truncate text-xs text-slate-500">{lesson.description}</div>}</div><CheckCircle2 size={16} className="hidden text-emerald-400 sm:block" /></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="learn-secondary-button" onClick={()=>void preview(lesson)}><CirclePlay size={14}/>Preview</button><button type="button" className="learn-secondary-button" onClick={()=>openEditLessonForm(lesson)}><Pencil size={14}/>Edit</button><button type="button" className="learn-secondary-button" onClick={()=>void deleteLesson(lesson)}><Trash2 size={14}/>Delete</button></div></div>)}</div>}
          </div>
        </article>;
      })}
    </div>
    {previewLesson && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${previewLesson.title}`}><div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl border border-white/10 bg-slate-950 shadow-2xl"><div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-slate-950/95 p-5 backdrop-blur"><div><div className="learn-eyebrow">Admin preview · Student view</div><h2 className="mt-1 text-xl font-bold">{previewLesson.title}</h2><p className="mt-1 text-sm text-slate-400">This is how the saved lesson content is rendered for a learner.</p></div><button type="button" className="learn-secondary-button" onClick={closePreview}><X size={15}/>Close</button></div><div className="p-6">{loadingPreview ? <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin"/>Loading saved content...</div> : previewLesson.content_type === "article" ? <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{previewLesson.content_body || "This article has no content yet."}</div> : previewLesson.content_type === "pdf" && previewUrl ? <iframe title={previewLesson.title} src={previewUrl} className="h-[70vh] w-full rounded-xl border border-white/10" /> : previewLesson.content_type === "video" && previewUrl ? (youtubeEmbed(previewUrl) ? <div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe title={previewLesson.title} src={youtubeEmbed(previewUrl) ?? undefined} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : <video controls className="max-h-[70vh] w-full rounded-xl bg-black" src={previewUrl}>Your browser does not support video playback.</video>) : previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer" className="learn-primary-button"><ExternalLink size={16}/>Open external content</a> : <p className="text-sm text-slate-500">No lesson content has been saved yet.</p>}</div></div></div>}
  </LearnShell>;
}
