import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, CirclePlay, ExternalLink, FileText, Link2, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Course = { id: string; title: string; slug: string; status: string };
type Module = { id: string; title: string; description: string | null; sort_order: number };
type Lesson = { id: string; module_id: string; title: string; description: string | null; content_url: string | null; content_body: string | null; content_storage_path: string | null; content_type: string | null; sort_order: number; is_preview: boolean };
type Draft = { id?: string; moduleId: string; title: string; description: string; url: string; body: string; type: string; preview: boolean; file: File | null; existingStoragePath: string | null };
type ModuleDraft = { id?: string; title: string; description: string };

export const Route = createFileRoute("/learn/manage/course-content/$courseId")({ component: CourseContentManager });

function CourseContentManager() {
  const { courseId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [moduleDraft, setModuleDraft] = useState<ModuleDraft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingModule, setSavingModule] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);
  const [deletingModule, setDeletingModule] = useState<string | null>(null);
  const [deletingLesson, setDeletingLesson] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You are not signed in."); setLoading(false); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || profile?.role !== "admin") { setError(profileError?.message || "Only admins can manage course content."); setLoading(false); return; }
    setIsAdmin(true);
    const { data: c, error: courseError } = await supabase.from("courses").select("id,title,slug,status").eq("id", courseId).maybeSingle();
    if (courseError || !c) { setError(courseError?.message || "Course not found."); setLoading(false); return; }
    setCourse(c as Course);
    const { data: ms, error: moduleError } = await supabase.from("course_modules").select("id,title,description,sort_order").eq("course_id", courseId).order("sort_order");
    if (moduleError) { setError(moduleError.message); setLoading(false); return; }
    const loadedModules = (ms || []) as Module[];
    setModules(loadedModules);
    if (!loadedModules.length) { setLessons([]); setLoading(false); return; }
    const { data: ls, error: lessonError } = await supabase.from("course_lessons").select("id,module_id,title,description,content_url,content_body,content_storage_path,content_type,sort_order,is_preview").in("module_id", loadedModules.map((m) => m.id)).order("sort_order");
    if (lessonError) setError(lessonError.message); else setLessons((ls || []) as Lesson[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [courseId]);

  function clearMessages() { setError(""); setSuccess(""); }
  function resetFile() { if (fileRef.current) fileRef.current.value = ""; }

  function openNewModule() { setModuleDraft({ title: "", description: "" }); clearMessages(); }
  function openEditModule(module: Module) { setModuleDraft({ id: module.id, title: module.title, description: module.description || "" }); clearMessages(); }

  async function saveModule(event: React.FormEvent) {
    event.preventDefault();
    if (!moduleDraft?.title.trim()) { setError("Module title is required."); return; }
    setSavingModule(true); clearMessages();
    const values = { title: moduleDraft.title.trim(), description: moduleDraft.description.trim() || null };
    const result = moduleDraft.id
      ? await supabase.from("course_modules").update(values).eq("id", moduleDraft.id)
      : await supabase.from("course_modules").insert({ course_id: courseId, ...values, sort_order: modules.length ? Math.max(...modules.map((m) => m.sort_order)) + 1 : 1 });
    if (result.error) setError(result.error.message);
    else { setSuccess(moduleDraft.id ? "Module updated successfully." : "Module added successfully."); setModuleDraft(null); await load(); }
    setSavingModule(false);
  }

  async function deleteModule(module: Module) {
    if (!window.confirm(`Delete module "${module.title}" and all of its lessons?`)) return;
    setDeletingModule(module.id); clearMessages();
    const moduleLessons = lessons.filter((l) => l.module_id === module.id);
    const storagePaths = moduleLessons.map((l) => l.content_storage_path).filter(Boolean) as string[];
    if (storagePaths.length) await supabase.storage.from("course-content").remove(storagePaths);
    const { error: deleteError } = await supabase.from("course_modules").delete().eq("id", module.id);
    if (deleteError) setError(deleteError.message); else { setSuccess("Module deleted successfully."); await load(); }
    setDeletingModule(null);
  }

  function openNewLesson(moduleId: string) {
    setDraft({ moduleId, title: "", description: "", url: "", body: "", type: "video", preview: false, file: null, existingStoragePath: null });
    clearMessages(); resetFile();
  }

  function openEditLesson(lesson: Lesson) {
    setDraft({ id: lesson.id, moduleId: lesson.module_id, title: lesson.title, description: lesson.description || "", url: lesson.content_url || "", body: lesson.content_body || "", type: lesson.content_type || "video", preview: lesson.is_preview, file: null, existingStoragePath: lesson.content_storage_path });
    clearMessages(); resetFile();
  }

  function setContentType(type: string) { setDraft((d) => d ? { ...d, type, url: "", body: "", file: null } : d); resetFile(); }

  async function saveLesson(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    clearMessages();
    if (!draft.title.trim()) { setError("Lesson title is required."); return; }
    if (draft.type === "article" && !draft.body.trim()) { setError("Article / text content is required."); return; }
    if ((draft.type === "video" || draft.type === "pdf") && !draft.file && !draft.url.trim() && !draft.existingStoragePath) { setError("Upload a file or enter an external content URL."); return; }
    if (draft.type === "link" && !draft.url.trim()) { setError("External link URL is required."); return; }
    if (draft.file && draft.file.size > 1073741824) { setError("The selected file is larger than the 1 GB limit."); return; }
    setSavingLesson(true);
    const existing = draft.id ? lessons.find((lesson) => lesson.id === draft.id) : null;
    let storagePath = existing?.content_storage_path || null;
    const oldStoragePath = storagePath;
    if (draft.file) {
      const safeName = draft.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      storagePath = `${draft.id || crypto.randomUUID()}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("course-content").upload(storagePath, draft.file, { contentType: draft.file.type, upsert: false });
      if (uploadError) { setError(`Upload failed: ${uploadError.message}`); setSavingLesson(false); return; }
    } else if (draft.type === "article" || draft.type === "link" || draft.url.trim()) storagePath = null;

    const moduleLessons = lessons.filter((lesson) => lesson.module_id === draft.moduleId);
    const values = {
      module_id: draft.moduleId,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      content_url: draft.file || draft.type === "article" ? null : (draft.url.trim() || null),
      content_body: draft.type === "article" ? draft.body.trim() : null,
      content_storage_path: storagePath,
      content_type: draft.type,
      sort_order: existing?.sort_order ?? (moduleLessons.length ? Math.max(...moduleLessons.map((lesson) => lesson.sort_order)) + 1 : 1),
      is_preview: draft.preview,
    };
    const result = draft.id ? await supabase.from("course_lessons").update(values).eq("id", draft.id) : await supabase.from("course_lessons").insert(values);
    if (result.error) {
      if (draft.file && storagePath) await supabase.storage.from("course-content").remove([storagePath]);
      setError(result.error.message); setSavingLesson(false); return;
    }
    if (oldStoragePath && oldStoragePath !== storagePath) await supabase.storage.from("course-content").remove([oldStoragePath]);
    setSuccess(draft.id ? "Lesson updated successfully." : "Lesson added successfully.");
    setDraft(null); resetFile(); await load(); setSavingLesson(false);
  }

  async function deleteLesson(lesson: Lesson) {
    if (!window.confirm(`Delete lesson "${lesson.title}"?`)) return;
    setDeletingLesson(lesson.id); clearMessages();
    if (lesson.content_storage_path) await supabase.storage.from("course-content").remove([lesson.content_storage_path]);
    const { error: deleteError } = await supabase.from("course_lessons").delete().eq("id", lesson.id);
    if (deleteError) setError(deleteError.message); else { setSuccess("Lesson deleted successfully."); await load(); }
    setDeletingLesson(null);
  }

  async function previewLessonContent(lesson: Lesson) {
    setPreviewLesson(lesson); setPreviewUrl(null); setPreviewLoading(true); clearMessages();
    if (lesson.content_storage_path) {
      const { data, error: signedUrlError } = await supabase.storage.from("course-content").createSignedUrl(lesson.content_storage_path, 3600);
      if (signedUrlError) setError(signedUrlError.message); else setPreviewUrl(data?.signedUrl || null);
    } else setPreviewUrl(lesson.content_url);
    setPreviewLoading(false);
  }

  function youtubeEmbed(url: string | null) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtube.com")) { const id = parsed.searchParams.get("v"); return id ? `https://www.youtube.com/embed/${id}` : null; }
      if (parsed.hostname === "youtu.be") return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    } catch { /* invalid URL is rendered as a normal link */ }
    return null;
  }

  function lessonTypeLabel(type: string | null) { return type === "article" ? "Text" : type === "link" ? "External link" : type === "pdf" ? "PDF" : "Video"; }

  if (loading) return <LearnShell><div className="learn-card p-6 text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={18} />Loading course content...</div></LearnShell>;
  if (!isAdmin || !course) return <LearnShell><div className="learn-card p-6"><Link to="/learn/manage/courses" className="learn-secondary-button"><ArrowLeft size={15} />Back to Course Manager</Link><p className="mt-6 text-sm text-red-300">{error || "Course unavailable."}</p></div></LearnShell>;

  return <LearnShell>
    <div className="mb-6"><Link to="/learn/manage/courses" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} />Back to Course Manager</Link></div>
    <SectionHeader eyebrow="Admin · Course content" title={course.title} description="Build, preview and maintain every module and lesson in this course." />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {success && <div className="learn-card mb-5 border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}

    <section className="learn-card mb-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div><div className="learn-eyebrow">Course structure</div><h2 className="mt-1 text-xl font-bold">Modules</h2><p className="mt-1 text-sm text-slate-400">Create modules first, then add lessons directly inside each module.</p></div>
        {!moduleDraft && <button type="button" onClick={openNewModule} className="learn-primary-button"><Plus size={16} />Add module</button>}
      </div>
      {moduleDraft && <form onSubmit={saveModule} className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.03] p-5 space-y-4">
        <div className="learn-eyebrow">{moduleDraft.id ? "Edit module" : "New module"}</div>
        <input autoFocus value={moduleDraft.title} onChange={(e) => setModuleDraft({ ...moduleDraft, title: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400" placeholder="Module title" />
        <textarea value={moduleDraft.description} onChange={(e) => setModuleDraft({ ...moduleDraft, description: e.target.value })} rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400" placeholder="Module description (optional)" />
        <div className="flex justify-end gap-3"><button type="button" onClick={() => setModuleDraft(null)} className="learn-secondary-button">Cancel</button><button type="submit" disabled={savingModule} className="learn-primary-button">{savingModule ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{moduleDraft.id ? "Save module" : "Create module"}</button></div>
      </form>}
    </section>

    {modules.length === 0 && !moduleDraft && <div className="learn-card p-8 text-center"><BookOpen className="mx-auto mb-3 text-slate-400" size={28} /><h3 className="font-semibold">No modules yet</h3><p className="mt-1 text-sm text-slate-400">Use Add module above to create the first module.</p></div>}

    <div className="space-y-5">
      {modules.map((module, index) => {
        const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);
        const moduleLessonDraftOpen = draft?.moduleId === module.id;
        return <article key={module.id} className="learn-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-3"><div className="learn-icon-tile"><BookOpen size={19} /></div><div><div className="text-xs uppercase tracking-[.16em] text-slate-500">Module {index + 1}</div><h3 className="text-lg font-bold">{module.title}</h3>{module.description && <p className="mt-1 text-sm text-slate-400">{module.description}</p>}</div></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openEditModule(module)} className="learn-secondary-button"><Pencil size={15} />Edit module</button>
              <button type="button" onClick={() => void deleteModule(module)} disabled={deletingModule === module.id} className="learn-secondary-button">{deletingModule === module.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}Delete module</button>
            </div>
          </div>

          <div className="mt-5 border-t border-white/8 pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="font-semibold">Lessons <span className="text-sm text-slate-500">({moduleLessons.length})</span></h4>
              <button type="button" onClick={() => openNewLesson(module.id)} className="learn-primary-button"><Plus size={16} />Add lesson</button>
            </div>

            {moduleLessonDraftOpen && <form onSubmit={saveLesson} className="mt-5 space-y-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.03] p-5">
              <div className="flex items-center justify-between gap-3"><div className="learn-eyebrow">{draft?.id ? "Edit lesson" : "New lesson"}</div><button type="button" onClick={() => { setDraft(null); resetFile(); }} className="learn-secondary-button"><X size={15} />Close</button></div>
              <input autoFocus value={draft?.title || ""} onChange={(e) => setDraft(draft ? { ...draft, title: e.target.value } : draft)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400" placeholder="Lesson title" />
              <textarea value={draft?.description || ""} onChange={(e) => setDraft(draft ? { ...draft, description: e.target.value } : draft)} rows={2} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400" placeholder="Lesson description (optional)" />
              <div><div className="mb-2 text-sm font-medium">Lesson content</div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[{ v: "video", label: "Video", icon: CirclePlay }, { v: "article", label: "Text / article", icon: FileText }, { v: "pdf", label: "PDF", icon: FileText }, { v: "link", label: "External link", icon: Link2 }].map(({ v, label, icon: Icon }) => <button key={v} type="button" onClick={() => setContentType(v)} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${draft?.type === v ? "border-cyan-400 bg-cyan-400/10 text-white" : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"}`}><Icon size={17} /><span>{label}</span></button>)}
              </div></div>
              {draft?.type === "article" ? <div><label className="mb-2 block text-sm font-medium">Lesson text</label><textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={12} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 placeholder:text-slate-400" placeholder="Write the lesson content students should read..." /></div> : <>
                {(draft?.type === "video" || draft?.type === "pdf") && <div><label className="mb-2 block text-sm font-medium">{draft.existingStoragePath ? "Replace uploaded file" : "Upload file"}</label><input ref={fileRef} type="file" accept={draft.type === "video" ? "video/mp4,video/webm,video/quicktime,video/x-matroska" : "application/pdf"} onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] || null })} className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300" />{draft.existingStoragePath && !draft.file && <p className="mt-2 text-xs text-emerald-300">Existing uploaded file is active. Choose another file only if you want to replace it.</p>}</div>}
                {(draft?.type === "video" || draft?.type === "pdf" || draft?.type === "link") && <div><label className="mb-2 block text-sm font-medium">{draft.type === "video" ? "Video link (YouTube, Vimeo, or direct URL)" : draft.type === "pdf" ? "PDF link (optional when using an upload)" : "External URL"}</label><input type="url" value={draft?.url || ""} onChange={(e) => setDraft(draft ? { ...draft, url: e.target.value } : draft)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400" placeholder={draft.type === "video" ? "https://..." : draft.type === "pdf" ? "https://..." : "https://..."} /></div>}
              </>}
              <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={draft?.preview || false} onChange={(e) => setDraft(draft ? { ...draft, preview: e.target.checked } : draft)} />Available as a student preview</label>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => { setDraft(null); resetFile(); }} className="learn-secondary-button">Cancel</button><button type="submit" disabled={savingLesson} className="learn-primary-button">{savingLesson ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{draft?.id ? "Save changes" : "Add lesson"}</button></div>
            </form>}

            {moduleLessons.length === 0 && !moduleLessonDraftOpen && <div className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">No lessons in this module yet. Click <span className="text-slate-300">Add lesson</span> above to add video, text, PDF, or a link.</div>}
            {moduleLessons.length > 0 && <div className="mt-4 space-y-3">{moduleLessons.map((lesson, lessonIndex) => <div key={lesson.id} className="rounded-xl border border-white/8 bg-white/[.03] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start">
                <div className="flex min-w-0 flex-1 items-center gap-3"><div className="learn-icon-tile">{lesson.content_type === "video" ? <CirclePlay size={17} /> : lesson.content_type === "link" ? <Link2 size={17} /> : <FileText size={17} />}</div><div className="min-w-0"><div className="text-xs text-slate-500">Lesson {lessonIndex + 1} · {lessonTypeLabel(lesson.content_type)} · {lesson.is_preview ? "Student preview" : "Restricted"}</div><div className="text-sm font-medium text-slate-200">{lesson.title}</div>{lesson.description && <div className="text-xs text-slate-500">{lesson.description}</div>}</div></div>
                <div className="flex flex-wrap gap-2 md:justify-end"><button type="button" onClick={() => void previewLessonContent(lesson)} className="learn-secondary-button"><CirclePlay size={14} />Preview</button><button type="button" onClick={() => openEditLesson(lesson)} className="learn-secondary-button"><Pencil size={14} />Edit</button><button type="button" onClick={() => void deleteLesson(lesson)} disabled={deletingLesson === lesson.id} className="learn-secondary-button">{deletingLesson === lesson.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}Delete</button></div>
              </div>
            </div>)}</div>}
          </div>
        </article>;
      })}
    </div>

    {previewLesson && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${previewLesson.title}`}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4"><div><div className="text-xs font-semibold uppercase tracking-[.16em] text-amber-600">Lesson preview</div><h3 className="mt-1 text-lg font-bold text-slate-900">{previewLesson.title}</h3></div><button type="button" onClick={() => { setPreviewLesson(null); setPreviewUrl(null); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close preview"><X size={20} /></button></div>
        <div className="max-h-[calc(90vh-82px)] overflow-auto p-5">
          {previewLoading && <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 size={24} className="mr-2 animate-spin" />Preparing preview...</div>}
          {!previewLoading && previewLesson.content_type === "article" && <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-6 text-sm leading-7 text-slate-800">{previewLesson.content_body}</div>}
          {!previewLoading && previewLesson.content_type === "video" && previewUrl && (youtubeEmbed(previewUrl) ? <iframe className="aspect-video w-full rounded-xl" src={youtubeEmbed(previewUrl) || undefined} title={previewLesson.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <video className="max-h-[65vh] w-full rounded-xl bg-black" src={previewUrl} controls />)}
          {!previewLoading && previewLesson.content_type === "pdf" && previewUrl && <iframe className="h-[65vh] w-full rounded-xl border border-slate-200" src={previewUrl} title={previewLesson.title} />}
          {!previewLoading && previewLesson.content_type === "link" && previewUrl && <div className="rounded-xl bg-slate-50 p-8 text-center"><Link2 className="mx-auto mb-3 text-slate-400" size={28} /><p className="text-sm text-slate-600">This lesson opens an external resource.</p><a className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" href={previewUrl} target="_blank" rel="noreferrer">Open external link <ExternalLink size={15} /></a></div>}
          {!previewLoading && !previewUrl && previewLesson.content_type !== "article" && <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No previewable content is available for this lesson.</div>}
        </div>
      </div>
    </div>}
  </LearnShell>;
}
