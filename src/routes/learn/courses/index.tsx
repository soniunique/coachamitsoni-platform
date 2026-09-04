import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { ProgramPurchaseButton } from "@/components/learn/ProgramPurchaseButton";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/learn/courses")({ component: Courses });

type Course = { id: string; slug: string; title: string; description: string | null; thumbnail_url: string | null; status: string; program_id: string };
type Program = { id: string; title: string; description: string | null; status: string; sort_order: number; payment_enabled: boolean; price_inr: number };
type Module = { id: string; course_id: string };
type Lesson = { id: string; module_id: string };

function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [enrolledPrograms, setEnrolledPrograms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");

  useEffect(() => {
    async function loadCourses() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setDbError("Please sign in to view your learning programs."); setLoading(false); return; }
      const [{ data: programData, error: programError }, { data: courseData, error: courseError }, { data: enrollmentData, error: enrollmentError }] = await Promise.all([
        (supabase as any).from("programs").select("id, title, description, status, sort_order, payment_enabled, price_inr").eq("status", "published").order("sort_order", { ascending: true }),
        supabase.from("courses").select("id, slug, title, description, thumbnail_url, status, program_id").eq("status", "published").order("created_at", { ascending: false }),
        supabase.from("program_enrollments").select("program_id, status").eq("user_id", user.id).in("status", ["active", "completed"]),
      ]);
      if (programError || courseError || enrollmentError) { setDbError(programError?.message ?? courseError?.message ?? enrollmentError?.message ?? "Unable to load courses right now."); setLoading(false); return; }
      const loadedCourses = (courseData ?? []) as Course[];
      setPrograms((programData ?? []).map((program: any) => ({ ...program, payment_enabled: Boolean(program.payment_enabled), price_inr: Number(program.price_inr ?? 0) })) as Program[]);
      setCourses(loadedCourses);
      setEnrolledPrograms(new Set((enrollmentData ?? []).map((row: { program_id: string }) => row.program_id)));
      if (!loadedCourses.length) { setModules([]); setLessons([]); setCompleted(new Set()); setLoading(false); return; }
      const { data: moduleData, error: moduleError } = await supabase.from("course_modules").select("id, course_id").in("course_id", loadedCourses.map(c => c.id));
      if (moduleError) { setDbError(moduleError.message); setLoading(false); return; }
      const loadedModules = (moduleData ?? []) as Module[]; setModules(loadedModules);
      const moduleIds = loadedModules.map(m => m.id);
      const { data: lessonData, error: lessonError } = moduleIds.length ? await supabase.from("course_lessons").select("id, module_id").in("module_id", moduleIds) : { data: [], error: null };
      if (lessonError) { setDbError(lessonError.message); setLoading(false); return; }
      const loadedLessons = (lessonData ?? []) as Lesson[]; setLessons(loadedLessons);
      const { data: progressData, error: progressError } = loadedLessons.length ? await supabase.from("lesson_progress").select("lesson_id, completed").eq("user_id", user.id).in("lesson_id", loadedLessons.map(l => l.id)) : { data: [], error: null };
      if (progressError) { setDbError(progressError.message); setLoading(false); return; }
      setCompleted(new Set((progressData ?? []).filter((row: { completed: boolean }) => row.completed).map((row: { lesson_id: string }) => row.lesson_id)));
      setLoading(false);
    }
    void loadCourses();
  }, []);

  const visiblePrograms = useMemo(() => programs.filter(program => courses.some(course => course.program_id === program.id)), [programs, courses]);
  const progressFor = (courseId: string) => {
    const courseModuleIds = new Set(modules.filter(module => module.course_id === courseId).map(module => module.id));
    const courseLessons = lessons.filter(lesson => courseModuleIds.has(lesson.module_id));
    const done = courseLessons.filter(lesson => completed.has(lesson.id)).length;
    return { total: courseLessons.length, done, percent: courseLessons.length ? Math.round((done / courseLessons.length) * 100) : 0 };
  };

  return <LearnShell><SectionHeader eyebrow="My learning" title="Programs & Courses" description="Continue your learning journey and track your progress"/>
    {loading ? <div className="learn-card flex items-center gap-3 p-6 text-sm text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading your programs...</div> : dbError ? <div className="learn-card p-6 text-sm text-red-300">{dbError}</div> : visiblePrograms.length === 0 ? <div className="learn-card p-8 text-center"><BookOpen className="mx-auto text-cyan-300" size={32}/><h2 className="mt-4 text-lg font-bold">No program access yet</h2><p className="mt-2 text-sm text-slate-400">Your courses will appear here</p></div> : <div className="space-y-8">{visiblePrograms.map(program=>{const programCourses=courses.filter(course=>course.program_id===program.id); const hasAccess=enrolledPrograms.has(program.id); return <section key={program.id}><div className="mb-4"><div className="flex flex-wrap items-center gap-3"><div><div className="text-xs uppercase tracking-[.16em] text-cyan-300">Program</div><h2 className="mt-1 text-2xl font-bold">{program.title}</h2></div>{hasAccess&&<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300"><CheckCircle2 size={13}/>Enrolled</span>}</div>{program.description&&<p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{program.description}</p>}{!hasAccess&&program.payment_enabled&&program.price_inr>0&&<div className="mt-4 flex flex-col gap-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><LockKeyhole size={18} className="mt-0.5 shrink-0 text-cyan-300"/><div><div className="text-sm font-semibold text-white">Unlock this program</div><p className="mt-1 text-xs leading-5 text-slate-400">One purchase gives you access to all {programCourses.length} published course{programCourses.length===1?"":"s"} in this program.</p></div></div><div className="sm:w-64"><ProgramPurchaseButton programId={program.id} programTitle={program.title} priceInr={program.price_inr}/></div></div>}</div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{programCourses.map(course=>{const p=progressFor(course.id); return <article className="learn-card learn-course-card overflow-hidden" key={course.id}><div className="relative h-40 w-full overflow-hidden"><img src={course.thumbnail_url || ""} alt="" className="h-full w-full object-cover" onError={e=>{e.currentTarget.style.display="none";const fallback=e.currentTarget.nextElementSibling;if(fallback instanceof HTMLElement)fallback.classList.remove("hidden");}}/><div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyan-500/15 via-violet-500/15 to-orange-500/15 ${course.thumbnail_url?"hidden":""}`}><BookOpen size={38} className="text-cyan-300/70"/></div></div><div className="p-6"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">{course.title}</h3>{p.percent===100&&<CheckCircle2 size={18} className="shrink-0 text-emerald-400"/>}</div><p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{course.description||"Explore this course."}</p><div className="mt-5"><div className="flex items-center justify-between text-xs"><span className="text-slate-400">Progress</span><span className="font-semibold text-cyan-300">{p.percent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{width:`${p.percent}%`}}/></div><div className="mt-2 text-xs text-slate-500">{p.done} of {p.total} lessons complete</div></div><Link to="/learn/courses/$slug" params={{slug:course.slug}} className="learn-secondary-button mt-5 w-full">{p.percent>0&&p.percent<100?"Continue course":"View course"} <ArrowUpRight size={15}/></Link></div></article>})}</div></section>})}</div>}
  </LearnShell>;
}
