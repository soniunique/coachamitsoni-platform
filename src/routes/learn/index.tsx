import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, CheckCircle2, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/")({ component: LearnHome });

type Course = { id: string; slug: string; title: string; description: string | null; program_id: string };
type Program = { id: string; title: string };
type Module = { id: string; course_id: string };
type Lesson = { id: string; module_id: string };
type CourseProgress = Course & { total: number; done: number; percent: number };

function LearnHome() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setDbError("Please sign in to continue."); setLoading(false); return; }
      const [{ data: programData, error: programError }, { data: courseData, error: courseError }] = await Promise.all([
        supabase.from("programs").select("id,title").order("sort_order", { ascending: true }),
        supabase.from("courses").select("id,slug,title,description,program_id").eq("status", "published").order("created_at", { ascending: false }),
      ]);
      if (programError || courseError) { setDbError(programError?.message ?? courseError?.message ?? "Unable to load your learning data."); setLoading(false); return; }
      const loadedCourses = (courseData ?? []) as Course[];
      setPrograms((programData ?? []) as Program[]); setCourses(loadedCourses);
      if (!loadedCourses.length) { setLoading(false); return; }
      const { data: moduleData, error: moduleError } = await supabase.from("course_modules").select("id,course_id").in("course_id", loadedCourses.map(c => c.id));
      if (moduleError) { setDbError(moduleError.message); setLoading(false); return; }
      const loadedModules = (moduleData ?? []) as Module[]; setModules(loadedModules);
      const moduleIds = loadedModules.map(m => m.id);
      const { data: lessonData, error: lessonError } = moduleIds.length ? await supabase.from("course_lessons").select("id,module_id").in("module_id", moduleIds) : { data: [], error: null };
      if (lessonError) { setDbError(lessonError.message); setLoading(false); return; }
      const loadedLessons = (lessonData ?? []) as Lesson[]; setLessons(loadedLessons);
      const { data: progressData, error: progressError } = loadedLessons.length ? await supabase.from("lesson_progress").select("lesson_id,completed").eq("user_id", user.id).in("lesson_id", loadedLessons.map(l => l.id)) : { data: [], error: null };
      if (progressError) { setDbError(progressError.message); setLoading(false); return; }
      setCompleted(new Set((progressData ?? []).filter((row: { completed: boolean }) => row.completed).map((row: { lesson_id: string }) => row.lesson_id)));
      setLoading(false);
    }
    void load();
  }, []);

  const progress = useMemo<CourseProgress[]>(() => courses.map(course => {
    const moduleIds = new Set(modules.filter(m => m.course_id === course.id).map(m => m.id));
    const courseLessons = lessons.filter(l => moduleIds.has(l.module_id));
    const done = courseLessons.filter(l => completed.has(l.id)).length;
    return { ...course, total: courseLessons.length, done, percent: courseLessons.length ? Math.round(done / courseLessons.length * 100) : 0 };
  }), [courses, modules, lessons, completed]);

  const overall = useMemo(() => {
    const total = progress.reduce((sum, c) => sum + c.total, 0);
    const done = progress.reduce((sum, c) => sum + c.done, 0);
    return { total, done, percent: total ? Math.round(done / total * 100) : 0 };
  }, [progress]);

  const continueCourse = useMemo(() => progress.find(c => c.percent > 0 && c.percent < 100) ?? progress.find(c => c.percent < 100) ?? progress[0] ?? null, [progress]);

  return <LearnShell>
    <SectionHeader eyebrow="Student dashboard" title="Welcome to your learning hub" description="Continue your learning journey and track your progress" action={<Link to="/learn/workshops" className="learn-secondary-button">Explore workshops <ArrowUpRight size={15}/></Link>} />

    {loading ? <div className="learn-card flex items-center gap-3 p-6 text-sm text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading your learning...</div> : dbError ? <div className="learn-card p-6 text-sm text-red-300">{dbError}</div> : <>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="learn-card p-5"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Programs</div><div className="mt-2 text-2xl font-bold">{programs.length}</div><div className="mt-1 text-xs text-slate-400">Available to you</div></div><div className="learn-icon-tile"><BookOpen size={18}/></div></div></div>
        <div className="learn-card p-5"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Courses</div><div className="mt-2 text-2xl font-bold">{progress.length}</div><div className="mt-1 text-xs text-slate-400">Available to you</div></div><div className="learn-icon-tile"><Sparkles size={18}/></div></div></div>
        <div className="learn-card p-5"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Overall progress</div><div className="mt-2 text-2xl font-bold">{overall.percent}%</div><div className="mt-1 text-xs text-slate-400">{overall.done} of {overall.total} lessons complete</div></div><div className="learn-icon-tile"><CheckCircle2 size={18}/></div></div></div>
      </div>

      {continueCourse ? <div className="learn-card overflow-hidden p-0"><div className="h-1 bg-gradient-to-r from-cyan-400 via-violet-500 to-orange-400"/><div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center"><div><div className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Continue learning</div><h2 className="mt-2 text-xl font-bold">{continueCourse.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{continueCourse.description || "Continue where you left off."}</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${continueCourse.percent}%` }}/></div><div className="mt-2 text-xs text-slate-500">{continueCourse.percent}% complete · {continueCourse.done} of {continueCourse.total} lessons</div></div><Link to="/learn/courses/$slug" params={{ slug: continueCourse.slug }} className="learn-primary-button">{continueCourse.percent > 0 ? "Continue" : "Start course"} <ArrowUpRight size={15}/></Link></div></div> : <div className="learn-card p-8 text-center"><BookOpen className="mx-auto text-cyan-300" size={32}/><h2 className="mt-4 text-lg font-bold">Your courses will appear here</h2><Link to="/learn/courses" className="learn-secondary-button mt-5">Browse courses <ArrowUpRight size={15}/></Link></div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
        <div className="learn-card p-6"><div className="flex items-center justify-between"><div><div className="learn-eyebrow">Your learning</div><h2 className="mt-2 text-xl font-bold">Course progress</h2></div><Link to="/learn/courses" className="text-xs text-cyan-300">View all</Link></div><div className="mt-5 space-y-4">{progress.slice(0,4).map(course=><Link key={course.id} to="/learn/courses/$slug" params={{slug:course.slug}} className="learn-feed-item block hover:bg-white/[.03]"><div className="learn-icon-tile"><BookOpen size={17}/></div><div className="min-w-0 flex-1"><div className="font-semibold truncate">{course.title}</div><div className="mt-1 text-xs text-slate-500">{course.done} of {course.total} lessons complete</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{width:`${course.percent}%`}}/></div></div><div className="text-sm font-semibold text-cyan-300">{course.percent}%</div></Link>)}{!progress.length&&<p className="text-sm text-slate-500">No courses available yet.</p>}</div></div>
        <div className="learn-card p-6"><div className="learn-eyebrow">Need help?</div><h2 className="mt-2 text-xl font-bold">Talk to us</h2><p className="mt-2 text-sm leading-6 text-slate-400">Questions about your learning?</p><Link to="/learn/messages" className="learn-secondary-button mt-5 w-full"><MessageSquare size={15}/> Open messages</Link></div>
      </div>
    </>}
  </LearnShell>;
}
