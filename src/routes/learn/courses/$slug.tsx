import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, ExternalLink, FileText, Film, Link2, Loader2, LockKeyhole, Menu, PlayCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/courses/$slug")({ component: CourseDetail });

type Course = { id: string; slug: string; title: string; description: string | null; thumbnail_url: string | null; status: string };
type Module = { id: string; title: string; description: string | null; sort_order: number };
type Lesson = { id: string; module_id: string; title: string; description: string | null; content_url: string | null; content_body: string | null; content_storage_path: string | null; content_type: string | null; sort_order: number; is_preview: boolean };

const contentMeta: Record<string, { label: string; icon: typeof Film }> = {
  video: { label: "Video", icon: Film },
  article: { label: "Article", icon: FileText },
  pdf: { label: "PDF", icon: FileText },
  external: { label: "External", icon: Link2 },
  "external-link": { label: "External", icon: Link2 },
};

function getYouTubeEmbed(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname === "youtu.be") return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
  } catch {}
  return null;
}

function CourseDetail() {
  const { slug } = Route.useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileOutlineOpen, setMobileOutlineOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const selectedIndex = selectedLesson ? lessons.findIndex((lesson) => lesson.id === selectedLesson.id) : -1;
  const previousLesson = selectedIndex > 0 ? lessons[selectedIndex - 1] : null;
  const nextLesson = selectedIndex >= 0 && selectedIndex < lessons.length - 1 ? lessons[selectedIndex + 1] : null;
  const completedCount = lessons.filter((lesson) => completed.has(lesson.id)).length;
  const progressPercent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

  const moduleProgress = useMemo(() => {
    const map = new Map<string, number>();
    for (const module of modules) map.set(module.id, lessons.filter((l) => l.module_id === module.id && completed.has(l.id)).length);
    return map;
  }, [modules, lessons, completed]);

  async function loadCourse() {
    setLoading(true); setError("");
    const { data: courseData, error: courseError } = await supabase.from("courses").select("id, slug, title, description, thumbnail_url, status").eq("slug", slug).eq("status", "published").maybeSingle();
    if (courseError || !courseData) { setError(courseError?.message ?? "Course not found."); setLoading(false); return; }
    setCourse(courseData as Course);
    const { data: moduleData, error: moduleError } = await supabase.from("course_modules").select("id, title, description, sort_order").eq("course_id", courseData.id).order("sort_order", { ascending: true });
    if (moduleError) { setError(moduleError.message); setLoading(false); return; }
    const loadedModules = (moduleData ?? []) as Module[];
    setModules(loadedModules);
    setExpandedModules(new Set(loadedModules.map((module) => module.id)));
    const moduleIds = loadedModules.map((m) => m.id);
    const { data: { user } } = await supabase.auth.getUser();
    let currentEnrolled = false;
    if (user) {
      const { data: enrollment } = await supabase.from("enrollments").select("id, status").eq("user_id", user.id).eq("course_id", courseData.id).in("status", ["active", "completed"]).maybeSingle();
      currentEnrolled = Boolean(enrollment);
    }
    setEnrolled(currentEnrolled);
    const { data: lessonData, error: lessonError } = await supabase.from("course_lessons").select("id, module_id, title, description, content_url, content_body, content_storage_path, content_type, sort_order, is_preview").in("module_id", moduleIds.length ? moduleIds : ["00000000-0000-0000-0000-000000000000"]).order("sort_order", { ascending: true });
    if (lessonError) { setError(lessonError.message); setLoading(false); return; }
    const loadedLessons = (lessonData ?? []) as Lesson[];
    setLessons(loadedLessons);
    if (user && loadedLessons.length) {
      const { data: progress } = await supabase.from("lesson_progress").select("lesson_id, completed").eq("user_id", user.id).in("lesson_id", loadedLessons.map((lesson) => lesson.id));
      setCompleted(new Set((progress ?? []).filter((item: { completed: boolean }) => item.completed).map((item: { lesson_id: string }) => item.lesson_id)));
    }
    setLoading(false);
  }

  useEffect(() => { void loadCourse(); }, [slug]);

  useEffect(() => {
    if (!course?.id) return;
    async function refreshEnrollment() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setEnrolled(false); setSelectedLessonId(null); setSelectedUrl(null); return; }
      const { data: enrollment } = await supabase.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", course.id).in("status", ["active", "completed"]).maybeSingle();
      const hasAccess = Boolean(enrollment);
      setEnrolled(hasAccess);
      if (!hasAccess) { setSelectedLessonId(null); setSelectedUrl(null); }
    }
    const interval = window.setInterval(() => void refreshEnrollment(), 5000);
    const handleFocus = () => void refreshEnrollment();
    const handleVisibility = () => { if (document.visibilityState === "visible") void refreshEnrollment(); };
    window.addEventListener("focus", handleFocus); document.addEventListener("visibilitychange", handleVisibility); void refreshEnrollment();
    return () => { window.clearInterval(interval); window.removeEventListener("focus", handleFocus); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [course?.id]);

  async function openLesson(lesson: Lesson) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setEnrolled(false); setSelectedLessonId(null); setSelectedUrl(null); setError("Course enrolment is required to open lessons."); return; }
    const { data: enrollment } = await supabase.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", course?.id ?? "").in("status", ["active", "completed"]).maybeSingle();
    if (!enrollment) { setEnrolled(false); setSelectedLessonId(null); setSelectedUrl(null); setError("Course enrolment is required to open lessons."); return; }
    const { data: freshLesson, error: freshLessonError } = await supabase.from("course_lessons").select("id, module_id, title, description, content_url, content_body, content_storage_path, content_type, sort_order, is_preview").eq("id", lesson.id).maybeSingle();
    if (freshLessonError || !freshLesson) { setEnrolled(false); setSelectedLessonId(null); setSelectedUrl(null); setError("This lesson is no longer available to your account."); return; }
    setEnrolled(true); setSelectedLessonId(freshLesson.id); setSelectedUrl(null); setLoadingLesson(true); setError("");
    if (freshLesson.content_storage_path) {
      const { data, error: signedError } = await supabase.storage.from("course-content").createSignedUrl(freshLesson.content_storage_path, 60);
      if (signedError) setError(signedError.message); else setSelectedUrl(data?.signedUrl ?? null);
    } else setSelectedUrl(freshLesson.content_url);
    setLoadingLesson(false);
    setMobileOutlineOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function markComplete() {
    if (!selectedLesson || !enrolled) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const isCurrentlyComplete = completed.has(selectedLesson.id);
    const nextCompleted = !isCurrentlyComplete;
    const { error: progressError } = await supabase.from("lesson_progress").upsert({ user_id: user.id, lesson_id: selectedLesson.id, completed: nextCompleted, completed_at: nextCompleted ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
    if (progressError) { setError(progressError.message); return; }
    setCompleted((previous) => { const next = new Set(previous); if (nextCompleted) next.add(selectedLesson.id); else next.delete(selectedLesson.id); return next; });
  }

  function toggleModule(moduleId: string) {
    setExpandedModules((previous) => { const next = new Set(previous); if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId); return next; });
  }

  async function moveToLesson(lesson: Lesson | null) { if (lesson) await openLesson(lesson); }

  if (loading) return <LearnShell><div className="learn-card flex items-center gap-3 p-6 text-slate-400"><Loader2 size={18} className="animate-spin" />Loading course...</div></LearnShell>;
  if (error && !course) return <LearnShell><div className="learn-card p-6"><Link to="/learn/courses" className="learn-secondary-button"><ArrowLeft size={15} />Back to courses</Link><p className="mt-6 text-sm text-red-300">{error}</p></div></LearnShell>;
  if (!course) return null;

  return <LearnShell>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <Link to="/learn/courses" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} />All courses</Link>
      <div className="flex items-center gap-2 text-xs text-slate-400"><span>{completedCount} of {lessons.length} lessons complete</span><span className="rounded-full border border-white/10 px-2.5 py-1">{progressPercent}%</span></div>
    </div>

    <section className="learn-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><div className="learn-eyebrow">Course</div><h1 className="mt-1 truncate text-2xl font-bold tracking-tight">{course.title}</h1><p className="mt-1 line-clamp-2 text-sm text-slate-400">{course.description || "Follow the modules in order and complete each lesson as you learn."}</p></div>
        <div className="shrink-0 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><div className="text-xs text-slate-500">Learning progress</div><div className="mt-1 flex items-center gap-3"><div className="h-2 w-28 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progressPercent}%` }} /></div><span className="font-semibold text-slate-200">{progressPercent}%</span></div></div>
      </div>
    </section>

    {!enrolled && <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100"><LockKeyhole size={17} /><span><strong>Course access required.</strong> An administrator must enrol you before lessons can be opened.</span></div>}
    {error && course && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</div>}

    <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="learn-card sticky top-5 overflow-hidden">
          <div className="border-b border-white/10 px-4 py-4"><div className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Course roadmap</div><div className="mt-1 text-sm text-slate-300">{modules.length} modules · {lessons.length} lessons</div></div>
          <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-2">
            {modules.map((module, moduleIndex) => { const moduleLessons=lessons.filter(l=>l.module_id===module.id); const open=expandedModules.has(module.id); const done=moduleProgress.get(module.id)??0; return <div key={module.id} className="mb-1 last:mb-0"><button type="button" onClick={()=>toggleModule(module.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left hover:bg-white/[.04]"><span className="text-slate-500">{open?<ChevronDown size={15}/>:<ChevronRight size={15}/>}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-200">{moduleIndex+1}. {module.title}</div><div className="text-[11px] text-slate-500">{done}/{moduleLessons.length} complete</div></div></button>{open&&<div className="ml-2 border-l border-white/10 pl-2">{moduleLessons.map((lesson,lessonIndex)=>{const active=lesson.id===selectedLessonId; const meta=contentMeta[lesson.content_type||""]||contentMeta.video; const Icon=meta.icon; return <button key={lesson.id} type="button" disabled={!enrolled} onClick={()=>void openLesson(lesson)} className={`mb-1 flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left ${active?"bg-cyan-400/10 text-cyan-100":"text-slate-400 hover:bg-white/[.04] hover:text-slate-200"} ${!enrolled?"cursor-not-allowed opacity-60":""}`}><span className="mt-0.5 shrink-0">{completed.has(lesson.id)?<CheckCircle2 size={15} className="text-emerald-400"/>:<Icon size={15}/>}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{lessonIndex+1}. {lesson.title}</span><span className="mt-0.5 block text-[10px] uppercase tracking-wide text-slate-600">{meta.label}</span></span></button>})}</div>}</div>})}
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between lg:hidden"><button type="button" className="learn-secondary-button" onClick={()=>setMobileOutlineOpen((value)=>!value)}><Menu size={16}/>{mobileOutlineOpen?"Close roadmap":"Course roadmap"}</button>{selectedLesson&&<span className="text-xs text-slate-500">Lesson {selectedIndex+1} of {lessons.length}</span>}</div>
        {mobileOutlineOpen&&<div className="mb-4 learn-card p-2 lg:hidden">{modules.map((module,moduleIndex)=>{const open=expandedModules.has(module.id);return <div key={module.id}><button type="button" onClick={()=>toggleModule(module.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left"><span>{open?<ChevronDown size={15}/>:<ChevronRight size={15}/>}</span><span className="text-sm font-semibold">{moduleIndex+1}. {module.title}</span></button>{open&&lessons.filter(l=>l.module_id===module.id).map((lesson,lessonIndex)=><button key={lesson.id} type="button" disabled={!enrolled} onClick={()=>void openLesson(lesson)} className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm text-slate-400 hover:bg-white/[.04] disabled:opacity-60"><span>{completed.has(lesson.id)?<CheckCircle2 size={15} className="text-emerald-400"/>:<PlayCircle size={15}/>}</span><span className="truncate">{lessonIndex+1}. {lesson.title}</span></button>)}</div>})}</div>}

        {!selectedLesson ? <div className="learn-card flex min-h-[420px] items-center justify-center p-8 text-center"><div className="max-w-md"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[.04]"><BookOpen size={24} className="text-cyan-300"/></div><h2 className="mt-5 text-xl font-bold">{enrolled?"Choose a lesson to begin":"Course lessons are locked"}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{enrolled?"Use the course roadmap to open a lesson. Your position and completion status will stay with your account.":"An administrator must enrol you before any lesson content can be opened."}</p>{enrolled&&lessons[0]&&<button type="button" className="learn-primary-button mt-5" onClick={()=>void openLesson(lessons[0])}><PlayCircle size={16}/>Start course</button>}</div></div> : <div className="space-y-4">
          <section className="learn-card overflow-hidden">
            <div className="border-b border-white/10 px-5 py-4 sm:px-6"><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span>{modules.findIndex(m=>m.id===selectedLesson.module_id)+1}. {modules.find(m=>m.id===selectedLesson.module_id)?.title}</span><span>•</span><span>Lesson {selectedIndex+1} of {lessons.length}</span><span>•</span><span>{contentMeta[selectedLesson.content_type||""]?.label || "Lesson"}</span></div><h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{selectedLesson.title}</h2>{selectedLesson.description&&<p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{selectedLesson.description}</p>}</div>
            <div className="p-5 sm:p-6">
              {loadingLesson?<div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading lesson content...</div>:
                selectedLesson.content_type==="article"?<article className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-7 text-slate-200">{selectedLesson.content_body||"This article has no content yet."}</article>:
                selectedLesson.content_type==="pdf"&&selectedUrl?<iframe title={selectedLesson.title} src={selectedUrl} className="h-[70vh] min-h-[480px] w-full rounded-xl border border-white/10 bg-black"/>:
                selectedLesson.content_type==="video"&&selectedUrl?(getYouTubeEmbed(selectedUrl)?<div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe title={selectedLesson.title} src={getYouTubeEmbed(selectedUrl)??undefined} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div>:<video controls className="max-h-[70vh] w-full rounded-xl bg-black" src={selectedUrl}>Your browser does not support video playback.</video>):
                selectedUrl?<div className="flex min-h-[240px] items-center justify-center"><a href={selectedUrl} target="_blank" rel="noreferrer" className="learn-primary-button"><ExternalLink size={16}/>Open external content</a></div>:
                <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">No lesson content has been added yet.</div>}
            </div>
          </section>

          <section className="learn-card p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={()=>void markComplete()} disabled={!enrolled} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${completed.has(selectedLesson.id)?"border-emerald-400/30 bg-emerald-400/10 text-emerald-200":"border-white/10 bg-white/[.04] text-slate-200 hover:bg-white/[.08]"}`}><Check size={17}/>{completed.has(selectedLesson.id)?"Completed — mark incomplete":"Mark lesson complete"}</button><div className="flex w-full gap-2 sm:w-auto"><button type="button" disabled={!previousLesson||!enrolled} onClick={()=>void moveToLesson(previousLesson)} className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/[.05] disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[150px]"><ArrowLeft size={16}/><span className="truncate">{previousLesson?previousLesson.title:"Previous"}</span></button><button type="button" disabled={!nextLesson||!enrolled} onClick={()=>void moveToLesson(nextLesson)} className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[150px]"><span className="truncate">{nextLesson?nextLesson.title:"Course complete"}</span><ArrowRight size={16}/></button></div></div></section>

          <div className="flex items-center justify-between px-1 text-xs text-slate-500"><span>{completedCount} of {lessons.length} lessons complete</span>{progressPercent===100&&<span className="inline-flex items-center gap-1.5 text-emerald-400"><CheckCircle2 size={14}/>Course complete</span>}</div>
        </div>}
      </div>
    </div>
  </LearnShell>;
}
