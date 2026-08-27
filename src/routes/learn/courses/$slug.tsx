import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, ExternalLink, FileText, Film, Link2, Loader2, LockKeyhole, Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/courses/$slug")({ component: CourseDetail });

type Course = { id: string; slug: string; title: string; description: string | null; thumbnail_url: string | null; status: string; program_id: string };
type Module = { id: string; title: string; description: string | null; sort_order: number };
type Lesson = { id: string; module_id: string; title: string; description: string | null; content_url: string | null; content_body: string | null; content_storage_path: string | null; content_type: string | null; sort_order: number; is_preview: boolean };

const meta: Record<string, { label: string; icon: typeof Film }> = {
  video: { label: "Video", icon: Film }, article: { label: "Text", icon: FileText }, pdf: { label: "PDF", icon: FileText }, external: { label: "Link", icon: Link2 }, "external-link": { label: "Link", icon: Link2 },
};

function youtubeEmbed(url: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) { const id = u.searchParams.get("v"); return id ? `https://www.youtube.com/embed/${id}` : null; }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
  } catch {}
  return null;
}

function CourseDetail() {
  const { slug } = Route.useParams();
  const [course, setCourse] = useState<Course | null>(null), [modules, setModules] = useState<Module[]>([]), [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrolled, setEnrolled] = useState(false), [isAdmin, setIsAdmin] = useState(false), [completed, setCompleted] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null), [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [loadingLesson, setLoadingLesson] = useState(false), [savingComplete, setSavingComplete] = useState(false);
  const [error, setError] = useState(""), [mobileOutlineOpen, setMobileOutlineOpen] = useState(false), [expanded, setExpanded] = useState<Set<string>>(new Set());

  const selected = lessons.find((l) => l.id === selectedId) ?? null;
  const selectedIndex = selected ? lessons.findIndex((l) => l.id === selected.id) : -1;
  const previous = selectedIndex > 0 ? lessons[selectedIndex - 1] : null;
  const next = selectedIndex >= 0 && selectedIndex < lessons.length - 1 ? lessons[selectedIndex + 1] : null;
  const completedCount = lessons.filter((l) => completed.has(l.id)).length;
  const progress = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;
  const moduleProgress = useMemo(() => new Map(modules.map((m) => [m.id, lessons.filter((l) => l.module_id === m.id && completed.has(l.id)).length])), [modules, lessons, completed]);

  async function loadCourse() {
    setLoading(true); setError("");
    const { data: c, error: ce } = await supabase.from("courses").select("id,slug,title,description,thumbnail_url,status,program_id").eq("slug", slug).eq("status", "published").maybeSingle();
    if (ce || !c) { setError(ce?.message || "Course not found."); setLoading(false); return; }
    setCourse(c as Course);
    const { data: ms, error: me } = await supabase.from("course_modules").select("id,title,description,sort_order").eq("course_id", c.id).order("sort_order");
    if (me) { setError(me.message); setLoading(false); return; }
    const loadedModules = (ms || []) as Module[]; setModules(loadedModules); setExpanded(new Set(loadedModules.map((m) => m.id)));
    const { data: { user } } = await supabase.auth.getUser();
    let admin = false, access = false;
    if (user) {
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(); admin = p?.role === "admin";
      if (admin) access = true; else { const { data: e } = await supabase.from("program_enrollments").select("id").eq("user_id", user.id).eq("program_id", c.program_id).in("status", ["active", "completed"]).maybeSingle(); access = Boolean(e); }
    }
    setIsAdmin(admin); setEnrolled(access);
    const ids = loadedModules.map((m) => m.id);
    const { data: ls, error: le } = await supabase.from("course_lessons").select("id,module_id,title,description,content_url,content_body,content_storage_path,content_type,sort_order,is_preview").in("module_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("sort_order");
    if (le) { setError(le.message); setLoading(false); return; }
    const loadedLessons = (ls || []) as Lesson[]; setLessons(loadedLessons);
    if (user && loadedLessons.length) {
      const { data: rows } = await supabase.from("lesson_progress").select("lesson_id,completed").eq("user_id", user.id).in("lesson_id", loadedLessons.map((l) => l.id));
      setCompleted(new Set((rows || []).filter((r: { completed: boolean }) => r.completed).map((r: { lesson_id: string }) => r.lesson_id)));
    } else setCompleted(new Set());
    setLoading(false);
  }

  useEffect(() => { void loadCourse(); }, [slug]);

  useEffect(() => {
    if (!course?.id || !enrolled || selectedId || !lessons.length) return;
    const firstIncomplete = lessons.find((l) => !completed.has(l.id)) || lessons[0];
    void openLesson(firstIncomplete, false);
  }, [course?.id, enrolled, lessons, completed, selectedId]);

  useEffect(() => {
    if (!course?.id) return;
    const refresh = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setEnrolled(false); setIsAdmin(false); setSelectedId(null); setSelectedUrl(null); return; }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      const admin = p?.role === "admin"; setIsAdmin(admin);
      if (admin) setEnrolled(true); else { const { data: e } = await supabase.from("program_enrollments").select("id").eq("user_id", user.id).eq("program_id", course.program_id).in("status", ["active", "completed"]).maybeSingle(); setEnrolled(Boolean(e)); }
    };
    const id = window.setInterval(() => void refresh(), 5000); void refresh();
    return () => window.clearInterval(id);
  }, [course?.id, course?.program_id]);

  async function openLesson(lesson: Lesson, markAsComplete = false) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Please sign in to access this course."); return; }
    const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const admin = p?.role === "admin";
    if (!admin) {
      const { data: e } = await supabase.from("program_enrollments").select("id").eq("user_id", user.id).eq("program_id", course?.program_id || "").in("status", ["active", "completed"]).maybeSingle();
      if (!e) { setEnrolled(false); setSelectedId(null); setSelectedUrl(null); setError("An administrator must enrol you in this program before lessons can be opened."); return; }
    }
    const { data: fresh, error: fe } = await supabase.from("course_lessons").select("id,module_id,title,description,content_url,content_body,content_storage_path,content_type,sort_order,is_preview").eq("id", lesson.id).maybeSingle();
    if (fe || !fresh) { setError(fe?.message || "This lesson is no longer available."); return; }
    setSelectedId(fresh.id); setSelectedUrl(null); setLoadingLesson(true); setError(""); setMobileOutlineOpen(false);
    if (fresh.content_storage_path) { const { data, error: se } = await supabase.storage.from("course-content").createSignedUrl(fresh.content_storage_path, 3600); if (se) setError(se.message); else setSelectedUrl(data?.signedUrl || null); }
    else setSelectedUrl(fresh.content_url);
    setLoadingLesson(false); window.scrollTo({ top: 0, behavior: "smooth" });
    if (markAsComplete && !admin && !completed.has(fresh.id)) await saveCompletion(fresh.id, true, user.id);
  }

  async function saveCompletion(lessonId: string, value: boolean, userId?: string) {
    const { data: { user } } = await supabase.auth.getUser(); const uid = userId || user?.id; if (!uid) return;
    setSavingComplete(true); setError("");
    const { error: pe } = await supabase.from("lesson_progress").upsert({ user_id: uid, lesson_id: lessonId, completed: value, completed_at: value ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
    if (pe) setError(pe.message); else setCompleted((prev) => { const n = new Set(prev); value ? n.add(lessonId) : n.delete(lessonId); return n; });
    setSavingComplete(false);
  }

  function toggleModule(id: string) { setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  if (loading) return <LearnShell><div className="learn-card flex items-center gap-2 p-6 text-slate-400"><Loader2 size={18} className="animate-spin" />Loading course...</div></LearnShell>;
  if (!course) return <LearnShell><div className="learn-card p-6"><Link to="/learn/courses" className="learn-secondary-button"><ArrowLeft size={15} />Back to courses</Link><p className="mt-5 text-sm text-red-300">{error || "Course not found."}</p></div></LearnShell>;

  const roadmap = <>
    <div className="border-b border-white/10 px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Content</div><div className="mt-1 text-xs text-slate-400">{completedCount} of {lessons.length} complete</div></div>
    <div className="max-h-[calc(100vh-150px)] overflow-y-auto p-2">{modules.map((m, mi) => { const ml = lessons.filter((l) => l.module_id === m.id); const open = expanded.has(m.id); const done = moduleProgress.get(m.id) || 0; return <div key={m.id} className="mb-1"><button type="button" onClick={() => toggleModule(m.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/[.04]"><span className="text-slate-500">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-200">{mi + 1}. {m.title}</span><span className="text-[10px] text-slate-500">{done}/{ml.length}</span></button>{open && <div className="ml-2 border-l border-white/10 pl-2">{ml.map((l, li) => { const Icon = (meta[l.content_type || ""] || meta.video).icon; const doneLesson = completed.has(l.id); return <button key={l.id} type="button" disabled={!enrolled} onClick={() => void openLesson(l, true)} className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] ${selectedId === l.id ? "bg-cyan-400/10 text-cyan-200" : "text-slate-400 hover:bg-white/[.04]"} ${!enrolled ? "opacity-50" : ""}`}><span className="shrink-0">{doneLesson ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Icon size={14} />}</span><span className="min-w-0 flex-1 truncate">{li + 1}. {l.title}</span></button>; })}</div>}</div>; })}</div>
  </>;

  return <LearnShell>
    {!selected ? <>
      <div className="mb-4 flex items-center justify-between"><Link to="/learn/courses" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} />All courses</Link><span className="text-xs text-slate-500">{progress}% complete</span></div>
      <section className="learn-card p-5"><div className="learn-eyebrow">Course</div><h1 className="mt-1 text-2xl font-bold tracking-tight">{course.title}</h1><p className="mt-2 text-sm text-slate-400">{course.description || "Follow the course lessons at your own pace."}</p>{!enrolled && <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-100"><LockKeyhole size={16} />An administrator must enrol you in this program before lessons can be opened.</div>}</section>
      <div className="mt-4 learn-card overflow-hidden">{roadmap}</div>
    </> : <>
      <div className="mb-3 flex items-center justify-between gap-3"><Link to="/learn/courses" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft size={14} />All courses</Link><div className="text-xs text-slate-500">{completedCount}/{lessons.length} complete · {progress}%</div></div>
      <div className="mb-3 lg:hidden"><button type="button" className="learn-secondary-button" onClick={() => setMobileOutlineOpen((v) => !v)}><Menu size={15} />{mobileOutlineOpen ? "Close content" : "Content"}</button>{mobileOutlineOpen && <div className="mt-2 learn-card overflow-hidden">{roadmap}</div>}</div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-start">
        <main className="min-w-0">
          <section className="learn-card overflow-hidden">
            <div className="aspect-video min-h-[260px] bg-black flex items-center justify-center">
              {loadingLesson ? <Loader2 size={28} className="animate-spin text-slate-400" /> : selected.content_type === "article" ? <article className="h-full w-full overflow-auto bg-white p-5 text-left text-sm leading-6 text-slate-800 whitespace-pre-wrap">{selected.content_body || "No text has been added to this lesson."}</article> : selected.content_type === "pdf" && selectedUrl ? <iframe src={selectedUrl} title={selected.title} className="h-full w-full" /> : selected.content_type === "video" && selectedUrl ? (youtubeEmbed(selectedUrl) ? <iframe src={youtubeEmbed(selectedUrl) || undefined} title={selected.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <video src={selectedUrl} controls className="h-full w-full object-contain" />) : selectedUrl ? <a href={selectedUrl} target="_blank" rel="noreferrer" className="learn-primary-button"><ExternalLink size={16} />Open content</a> : <div className="text-sm text-slate-500">No lesson content has been added.</div>}
            </div>
            <div className="border-t border-white/10 px-4 py-3 sm:px-5"><div className="text-[10px] uppercase tracking-[.14em] text-slate-500">{meta[selected.content_type || ""]?.label || "Lesson"}</div><div className="mt-1 flex items-start justify-between gap-3"><div><h1 className="text-lg font-bold text-white">{selected.title}</h1>{selected.description && <p className="mt-1 text-xs leading-5 text-slate-400">{selected.description}</p>}</div>{completed.has(selected.id) && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300"><Check size={12} />Complete</span>}</div></div>
          </section>
          <section className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => void saveCompletion(selected.id, !completed.has(selected.id))} disabled={!enrolled || savingComplete} className={`learn-secondary-button ${completed.has(selected.id) ? "border-emerald-400/30 text-emerald-300" : ""}`}><Check size={15} />{savingComplete ? "Saving…" : completed.has(selected.id) ? "Mark incomplete" : "Mark complete"}</button><div className="flex gap-2"><button type="button" disabled={!previous || !enrolled} onClick={() => previous && void openLesson(previous, false)} className="learn-secondary-button disabled:opacity-40"><ArrowLeft size={14} />Previous</button><button type="button" disabled={!next || !enrolled} onClick={() => next && void openLesson(next, false)} className="learn-primary-button disabled:opacity-40">{next ? "Next" : "Course complete"}<ArrowRight size={14} /></button></div></section>
          <div className="mt-2 text-[10px] text-slate-500">Lesson {selectedIndex + 1} of {lessons.length}</div>
        </main>
        <aside className="hidden lg:block"><div className="learn-card sticky top-4 overflow-hidden">{roadmap}</div></aside>
      </div>
    </>}
  </LearnShell>;
}
