import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight, FileText, Film, Link2, Loader2, LockKeyhole, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/courses/$slug")({ component: CourseDetail });

type Course = { id: string; slug: string; title: string; description: string | null; thumbnail_url: string | null; status: string };
type Module = { id: string; title: string; description: string | null; sort_order: number };
type Lesson = { id: string; module_id: string; title: string; description: string | null; content_url: string | null; content_body: string | null; content_storage_path: string | null; content_type: string | null; sort_order: number; is_preview: boolean };

function youtube(url: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) { const id = u.searchParams.get("v"); return id ? `https://www.youtube.com/embed/${id}` : null; }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
  } catch {}
  return null;
}

function contentIcon(type: string | null) { if (type === "video") return Film; if (type === "pdf" || type === "article") return FileText; return Link2; }

function CourseDetail() {
  const { slug } = Route.useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rating, setRating] = useState(0);
  const [savingComplete, setSavingComplete] = useState(false);

  const selectedLesson = lessons.find((lesson) => lesson.id === selected) ?? null;
  const selectedIndex = selectedLesson ? lessons.findIndex((lesson) => lesson.id === selectedLesson.id) : -1;
  const previousLesson = selectedIndex > 0 ? lessons[selectedIndex - 1] : null;
  const nextLesson = selectedIndex >= 0 && selectedIndex < lessons.length - 1 ? lessons[selectedIndex + 1] : null;
  const doneCount = lessons.filter((lesson) => completed.has(lesson.id)).length;
  const progress = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
  const complete = progress === 100 && lessons.length > 0;
  const moduleStats = useMemo(() => new Map(modules.map((module) => [module.id, lessons.filter((lesson) => lesson.module_id === module.id).length])), [modules, lessons]);

  async function load() {
    setLoading(true); setError(""); setProgressLoaded(false); setSelected(null); setUrl(null);
    const { data: courseData, error: courseError } = await supabase.from("courses").select("id,slug,title,description,thumbnail_url,status").eq("slug", slug).eq("status", "published").maybeSingle();
    if (courseError || !courseData) { setError(courseError?.message || "Course not found."); setLoading(false); return; }
    setCourse(courseData as Course);
    const { data: moduleData, error: moduleError } = await supabase.from("course_modules").select("id,title,description,sort_order").eq("course_id", courseData.id).order("sort_order");
    if (moduleError) { setError(moduleError.message); setLoading(false); return; }
    const loadedModules = (moduleData || []) as Module[];
    setModules(loadedModules); setExpanded(new Set(loadedModules.map((module) => module.id)));
    const moduleIds = loadedModules.map((module) => module.id);
    const { data: lessonData, error: lessonError } = await supabase.from("course_lessons").select("id,module_id,title,description,content_url,content_body,content_storage_path,content_type,sort_order,is_preview").in("module_id", moduleIds.length ? moduleIds : ["00000000-0000-0000-0000-000000000000"]).order("sort_order");
    if (lessonError) { setError(lessonError.message); setLoading(false); return; }
    const loadedLessons = (lessonData || []) as Lesson[];
    setLessons(loadedLessons);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setEnrolled(false); setIsAdmin(false); setProgressLoaded(true); setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const admin = profile?.role === "admin";
    setIsAdmin(admin);
    if (admin) setEnrolled(true);
    else {
      const { data: enrollment } = await supabase.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", courseData.id).in("status", ["active", "completed"]).maybeSingle();
      setEnrolled(Boolean(enrollment));
    }
    if (loadedLessons.length) {
      const { data: progressRows } = await supabase.from("lesson_progress").select("lesson_id,completed").eq("user_id", user.id).in("lesson_id", loadedLessons.map((lesson) => lesson.id));
      setCompleted(new Set((progressRows || []).filter((row: { completed: boolean }) => row.completed).map((row: { lesson_id: string }) => row.lesson_id)));
    } else setCompleted(new Set());
    const saved = window.localStorage.getItem(`course-rating:${courseData.id}`); if (saved) setRating(Number(saved));
    setProgressLoaded(true); setLoading(false);
  }

  useEffect(() => { void load(); }, [slug]);

  useEffect(() => {
    if (!progressLoaded || !lessons.length || !enrolled || complete || selected) return;
    const firstIncomplete = lessons.find((lesson) => !completed.has(lesson.id)) ?? lessons[0];
    void openLesson(firstIncomplete, false);
  }, [progressLoaded, lessons, completed, enrolled, complete, selected]);

  async function openLesson(lesson: Lesson | null, markAsComplete = false) {
    if (!lesson) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Please sign in to access this course."); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const admin = profile?.role === "admin";
    if (!admin) {
      const { data: enrollment } = await supabase.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", course?.id || "").in("status", ["active", "completed"]).maybeSingle();
      if (!enrollment) { setEnrolled(false); setSelected(null); setUrl(null); setError("Course enrolment is required to open lessons."); return; }
    }
    const { data: freshLesson, error: freshError } = await supabase.from("course_lessons").select("id,module_id,title,description,content_url,content_body,content_storage_path,content_type,sort_order,is_preview").eq("id", lesson.id).maybeSingle();
    if (freshError || !freshLesson) { setError("This lesson is no longer available."); return; }
    setIsAdmin(admin); setEnrolled(true); setSelected(freshLesson.id); setLoadingLesson(true); setError("");
    let resource = freshLesson.content_url;
    if (freshLesson.content_storage_path) { const { data, error: signedError } = await supabase.storage.from("course-content").createSignedUrl(freshLesson.content_storage_path, 60); if (signedError) setError(signedError.message); resource = data?.signedUrl || null; }
    setUrl(resource); setLoadingLesson(false); window.scrollTo({ top: 0, behavior: "smooth" });
    if (markAsComplete && !admin && !completed.has(freshLesson.id)) await saveLessonCompletion(freshLesson.id, true, user.id);
  }

  async function saveLessonCompletion(lessonId: string, value: boolean, userId?: string) {
    const currentUserId = userId || (await supabase.auth.getUser()).data.user?.id; if (!currentUserId) return;
    setSavingComplete(true);
    const { error: progressError } = await supabase.from("lesson_progress").upsert({ user_id: currentUserId, lesson_id: lessonId, completed: value, completed_at: value ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
    if (progressError) setError(progressError.message); else setCompleted((previous) => { const next = new Set(previous); value ? next.add(lessonId) : next.delete(lessonId); return next; });
    setSavingComplete(false);
  }

  async function toggleSelectedCompletion() { if (!selectedLesson || !enrolled || isAdmin) return; await saveLessonCompletion(selectedLesson.id, !completed.has(selectedLesson.id)); }
  function rate(value: number) { setRating(value); if (course) window.localStorage.setItem(`course-rating:${course.id}`, String(value)); }

  if (loading) return <LearnShell><div className="learn-card flex items-center gap-3 p-8"><Loader2 size={18} className="animate-spin" />Loading course...</div></LearnShell>;
  if (!course) return <LearnShell><div className="learn-card p-6"><Link to="/learn/courses" className="learn-secondary-button"><ArrowLeft size={15} />Back to courses</Link><p className="mt-5 text-red-600">{error || "Course not found."}</p></div></LearnShell>;

  return <LearnShell>
    <Link to="/learn/courses" className="reference-back"><ArrowLeft size={15} />Back to courses</Link>
    <section className="reference-course-hero mt-4"><div className="grid gap-6 md:grid-cols-[250px_1fr] md:items-start">
      {course.thumbnail_url ? <img src={course.thumbnail_url} alt="" className="w-full rounded-lg object-cover" /> : <div className="flex h-36 items-center justify-center rounded-lg bg-slate-100"><FileText size={40} /></div>}
      <div><h1 className="text-2xl font-bold md:text-3xl">{course.title}</h1><p className="mt-2">{course.description || "Complete the lessons in this course at your own pace."}</p>
        {complete ? <div className="reference-complete mt-4 p-4"><div className="flex items-center gap-3"><CheckCircle2 size={19} /><strong>Congrats! You've completed the course.</strong></div><div className="reference-rate mt-3"><span>Rate this course</span>{[1,2,3,4,5].map((value) => <button key={value} type="button" className={`reference-star ${rating >= value ? "selected" : ""}`} onClick={() => rate(value)} aria-label={`Rate ${value} out of 5`}><Star size={20} fill={rating >= value ? "currentColor" : "none"} /></button>)}</div></div> : <div className="mt-4 flex max-w-sm items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="learn-progress-fill h-full rounded-full" style={{ width: `${progress}%` }} /></div><span className="text-xs font-semibold">{progress}%</span></div>}
        <button type="button" onClick={() => void openLesson(complete ? lessons[0] : selectedLesson || lessons[0], false)} disabled={!enrolled && !isAdmin} className="learn-course-action mt-4 disabled:opacity-50">{complete ? "View again" : progress > 0 ? "Continue" : "Start learning"}<ArrowRight size={15} /></button>
      </div>
    </div></section>
    {!enrolled && !isAdmin && <div className="reference-lock mt-4"><LockKeyhole size={16} /><span><strong>Course access required.</strong> An administrator must enrol you before lessons can be opened.</span></div>}
    {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

    {selectedLesson ? <section className="reference-player-shell mt-4">
      <div className="reference-player"><div className="reference-player-frame">
        {loadingLesson ? <Loader2 className="animate-spin" /> : youtube(url) ? <iframe src={youtube(url) || undefined} title={selectedLesson.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : selectedLesson.content_type === "video" && url ? <video src={url} controls className="h-full w-full" /> : selectedLesson.content_type === "pdf" && url ? <iframe src={url} title={selectedLesson.title} /> : selectedLesson.content_body ? <div className="h-full overflow-auto bg-white p-6 text-left text-sm leading-7" dangerouslySetInnerHTML={{ __html: selectedLesson.content_body }} /> : url ? <a href={url} target="_blank" rel="noreferrer" className="learn-course-action">Open content</a> : <div>No content available.</div>}
      </div><div className="reference-player-meta"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{selectedLesson.title}</h2>{selectedLesson.description && <p className="mt-1">{selectedLesson.description}</p>}</div>{completed.has(selectedLesson.id) && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700"><Check size={12} />Completed</span>}</div>
        <div className="reference-player-actions"><button type="button" onClick={() => void toggleSelectedCompletion()} disabled={isAdmin || savingComplete} className="learn-secondary-button disabled:opacity-50"><Check size={14} />{savingComplete ? "Saving…" : completed.has(selectedLesson.id) ? "Mark incomplete" : "Mark complete"}</button><div className="flex gap-2"><button type="button" disabled={!previousLesson || !enrolled} onClick={() => void openLesson(previousLesson, false)} className="learn-secondary-button disabled:opacity-40"><ArrowLeft size={14} />Previous</button><button type="button" disabled={!nextLesson || !enrolled} onClick={() => void openLesson(nextLesson, false)} className="learn-primary-button disabled:opacity-40">Next<ArrowRight size={14} /></button></div></div>
      </div></div>
      <aside className="reference-content-panel"><div className="reference-content-header"><span>Content</span><span className="text-[10px] font-medium text-slate-500">{doneCount} of {lessons.length}</span></div>
        {modules.map((module, moduleIndex) => { const open = expanded.has(module.id); const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id); return <div className="reference-content-section" key={module.id}>
          <button type="button" onClick={() => setExpanded((previous) => { const next = new Set(previous); next.has(module.id) ? next.delete(module.id) : next.add(module.id); return next; })}><span>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span><span>{moduleIndex + 1}. {module.title}</span><span>{moduleStats.get(module.id) || 0}</span></button>
          {open && moduleLessons.map((lesson, lessonIndex) => { const Icon = contentIcon(lesson.content_type); const done = completed.has(lesson.id); return <button key={lesson.id} type="button" disabled={!enrolled && !isAdmin} onClick={() => void openLesson(lesson, true)} className={`reference-outline-item w-full text-left ${done ? "done" : ""} ${selected === lesson.id ? "bg-amber-50" : ""}`}><span className="w-5 text-center text-[10px] font-bold">{String(lessonIndex + 1).padStart(2, "0")}</span>{done ? <CheckCircle2 size={15} /> : <Icon size={14} />}<span className="min-w-0 flex-1"><span className="block truncate">{lesson.title}</span>{lesson.description && <span className="reference-subtitle truncate">{lesson.description}</span>}</span><span className="text-[9px] uppercase text-slate-400">{lesson.content_type || "content"}</span></button>; })}
        </div>; })}
      </aside>
    </section> : <section className="reference-course-outline mt-4"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold">Contents</h2><p className="mt-1 text-xs">{modules.length} sections • {lessons.length} lectures</p></div>{modules.map((module, moduleIndex) => { const open = expanded.has(module.id); const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id); return <div key={module.id} className="border-b border-slate-200 last:border-0"><button type="button" onClick={() => setExpanded((previous) => { const next = new Set(previous); next.has(module.id) ? next.delete(module.id) : next.add(module.id); return next; })} className="flex w-full items-center gap-3 px-5 py-3 text-left"><span>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span><span className="flex-1 font-semibold text-sm">{moduleIndex + 1}. {module.title}</span><span className="text-[10px] text-slate-500">{moduleStats.get(module.id) || 0} lectures</span></button>{open && moduleLessons.map((lesson, lessonIndex) => { const Icon = contentIcon(lesson.content_type); return <button key={lesson.id} type="button" disabled={!enrolled && !isAdmin} onClick={() => void openLesson(lesson, true)} className={`reference-outline-item w-full text-left ${completed.has(lesson.id) ? "done" : ""}`}>{completed.has(lesson.id) ? <CheckCircle2 size={15} /> : <Icon size={14} />}<span className="w-5 text-center text-[10px] font-bold">{String(lessonIndex + 1).padStart(2, "0")}</span><span className="flex-1">{lesson.title}</span></button>; })}</div>; })}</section>}
  </LearnShell>;
}
