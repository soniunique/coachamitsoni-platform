import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Loader2, PlayCircle, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Program = { id: string; title: string; slug: string | null };
type Course = { id: string; slug: string; title: string; description: string | null; program_id: string };
type Module = { id: string; course_id: string };
type Lesson = { id: string; module_id: string };

export const Route = createFileRoute("/learn/my-learning")({ component: MyLearning });

function MyLearning() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [retakingCourseId, setRetakingCourseId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError("");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Please sign in to continue."); setLoading(false); return; }

      const { data: enrolments, error: enrolmentError } = await supabase
        .from("program_enrollments")
        .select("program_id")
        .eq("user_id", user.id)
        .in("status", ["active", "completed"]);
      if (enrolmentError) { setError(enrolmentError.message); setLoading(false); return; }

      const programIds = [...new Set((enrolments ?? []).map(row => row.program_id))];
      if (!programIds.length) { setLoading(false); return; }

      const [{ data: programData, error: programError }, { data: courseData, error: courseError }] = await Promise.all([
        supabase.from("programs").select("id,title,slug").in("id", programIds).order("sort_order", { ascending: true }),
        supabase.from("courses").select("id,slug,title,description,program_id").eq("status", "published").in("program_id", programIds).order("created_at", { ascending: false }),
      ]);
      if (programError || courseError) { setError(programError?.message ?? courseError?.message ?? "Unable to load your learning."); setLoading(false); return; }
      const loadedCourses = (courseData ?? []) as Course[];
      setPrograms((programData ?? []) as Program[]); setCourses(loadedCourses);
      if (!loadedCourses.length) { setLoading(false); return; }

      const { data: moduleData, error: moduleError } = await supabase.from("course_modules").select("id,course_id").in("course_id", loadedCourses.map(c => c.id));
      if (moduleError) { setError(moduleError.message); setLoading(false); return; }
      const loadedModules = (moduleData ?? []) as Module[]; setModules(loadedModules);
      const moduleIds = loadedModules.map(m => m.id);
      const { data: lessonData, error: lessonError } = moduleIds.length
        ? await supabase.from("course_lessons").select("id,module_id").in("module_id", moduleIds)
        : { data: [], error: null };
      if (lessonError) { setError(lessonError.message); setLoading(false); return; }
      const loadedLessons = (lessonData ?? []) as Lesson[]; setLessons(loadedLessons);
      if (loadedLessons.length) {
        const { data: progressData, error: progressError } = await supabase.from("lesson_progress").select("lesson_id,completed").eq("user_id", user.id).in("lesson_id", loadedLessons.map(l => l.id));
        if (progressError) { setError(progressError.message); setLoading(false); return; }
        setCompleted(new Set((progressData ?? []).filter(row => row.completed).map(row => row.lesson_id)));
      }
      setLoading(false);
    }
    void load();
  }, []);

  const courseProgress = useMemo(() => courses.map(course => {
    const moduleIds = new Set(modules.filter(m => m.course_id === course.id).map(m => m.id));
    const total = lessons.filter(l => moduleIds.has(l.module_id)).length;
    const done = lessons.filter(l => moduleIds.has(l.module_id) && completed.has(l.id)).length;
    return { ...course, total, done, percent: total ? Math.round(done / total * 100) : 0 };
  }), [courses, modules, lessons, completed]);

  const activeCourses = courseProgress.filter(c => c.percent < 100);
  const completedCourses = courseProgress.filter(c => c.percent === 100 && c.total > 0);
  const continueCourse = activeCourses.find(c => c.percent > 0) ?? activeCourses[0] ?? null;

  async function retakeCourse(course: (typeof courseProgress)[number]) {
    if (course.percent !== 100 || course.total <= 0 || retakingCourseId) return;
    const confirmed = window.confirm(
      `Retake “${course.title}”?\n\nThis will reset your lesson progress for this course and take you back through it from the beginning. Any certificate you have already earned will remain valid.`,
    );
    if (!confirmed) return;

    setRetakingCourseId(course.id); setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Please sign in to retake this course."); setRetakingCourseId(null); return; }

    const courseModuleIds = modules.filter(m => m.course_id === course.id).map(m => m.id);
    const courseLessonIds = lessons.filter(l => courseModuleIds.includes(l.module_id)).map(l => l.id);
    if (!courseLessonIds.length) { setRetakingCourseId(null); return; }

    const now = new Date().toISOString();
    const { error: resetError } = await supabase.from("lesson_progress").upsert(
      courseLessonIds.map(lessonId => ({ user_id: user.id, lesson_id: lessonId, completed: false, completed_at: null, updated_at: now })),
      { onConflict: "user_id,lesson_id" },
    );

    if (resetError) {
      setError(resetError.message);
      setRetakingCourseId(null);
      return;
    }

    setCompleted(prev => {
      const next = new Set(prev);
      courseLessonIds.forEach(lessonId => next.delete(lessonId));
      return next;
    });
    setRetakingCourseId(null);
    await navigate({ to: "/learn/courses/$slug", params: { slug: course.slug } });
  }

  return <LearnShell>
    <SectionHeader eyebrow="Student" title="My Learning" description="Everything you are enrolled in, with your progress in one place." action={<Link to="/learn/courses" className="learn-secondary-button">Browse courses <ArrowRight size={15} /></Link>} />
    {loading ? <div className="learn-card flex items-center gap-3 p-6 text-sm text-slate-400"><Loader2 size={18} className="animate-spin" />Loading your courses...</div> : error ? <div className="learn-card p-6 text-sm text-red-300">{error}</div> : <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="learn-card p-5"><div className="learn-eyebrow">Programs</div><div className="mt-2 text-2xl font-bold">{programs.length}</div><div className="mt-1 text-xs text-slate-500">Active programme access</div></div>
        <div className="learn-card p-5"><div className="learn-eyebrow">Courses</div><div className="mt-2 text-2xl font-bold">{courses.length}</div><div className="mt-1 text-xs text-slate-500">Available through your enrolments</div></div>
        <div className="learn-card p-5"><div className="learn-eyebrow">Completed</div><div className="mt-2 text-2xl font-bold">{completedCourses.length}</div><div className="mt-1 text-xs text-slate-500">Courses completed</div></div>
      </div>

      {continueCourse && <section className="learn-card mb-6 overflow-hidden"><div className="h-1 bg-gradient-to-r from-cyan-400 via-violet-500 to-orange-400"/><div className="p-6"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="learn-eyebrow">Continue learning</div><h2 className="mt-2 truncate text-xl font-bold">{continueCourse.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{continueCourse.description || "Continue where you left off."}</p><div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${continueCourse.percent}%` }} /></div><span className="text-xs font-semibold text-cyan-300">{continueCourse.percent}%</span></div></div><Link to="/learn/courses/$slug" params={{ slug: continueCourse.slug }} className="learn-primary-button shrink-0"><PlayCircle size={16} />Continue</Link></div></div></section>}

      <section className="mb-6"><div className="mb-4 flex items-end justify-between"><div><div className="learn-eyebrow">Your access</div><h2 className="mt-1 text-xl font-bold">Enrolled courses</h2></div><span className="text-xs text-slate-500">{courses.length} total</span></div>{courses.length === 0 ? <div className="learn-card p-8 text-center"><BookOpen className="mx-auto text-cyan-300" size={32}/><h3 className="mt-4 font-semibold">No courses yet</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">An administrator can enrol you in a program to give you access to its published courses.</p><Link to="/learn/courses" className="learn-secondary-button mt-4">Browse courses <ArrowRight size={14}/></Link></div> : <div className="grid gap-4 lg:grid-cols-2">{courseProgress.map(course => <article key={course.id} className="learn-card flex min-w-0 flex-col p-5"><div className="flex items-start gap-3"><div className="learn-icon-tile shrink-0"><BookOpen size={18}/></div><div className="min-w-0 flex-1"><div className="truncate font-semibold">{course.title}</div><div className="mt-1 text-xs text-slate-500">{programs.find(p => p.id === course.program_id)?.title || "Enrolled program"}</div></div>{course.percent === 100 && <CheckCircle2 className="shrink-0 text-emerald-400" size={20}/>}</div><div className="mt-5 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${course.percent}%` }}/></div><span className="text-xs font-semibold text-cyan-300">{course.percent}%</span></div><div className="mt-2 text-xs text-slate-500">{course.done} of {course.total} lessons complete</div><div className="mt-4 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-xs text-slate-500">{course.percent === 100 ? <Trophy size={14}/> : <Clock3 size={14}/>} {course.percent === 100 ? "Completed" : "In progress"}</span>{course.percent === 100 ? <button type="button" onClick={() => void retakeCourse(course)} disabled={retakingCourseId !== null} className="learn-secondary-button disabled:opacity-40">{retakingCourseId === course.id ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14}/>} {retakingCourseId === course.id ? "Retaking…" : "Retake"}<ArrowRight size={14}/></button> : <Link to="/learn/courses/$slug" params={{ slug: course.slug }} className="learn-secondary-button">{course.percent > 0 ? "Continue" : "Start course"}<ArrowRight size={14}/></Link>}</div></article>)}</div>}</section>

      {completedCourses.length > 0 && <section className="learn-card p-6"><div className="flex items-center gap-3"><Trophy className="text-amber-300" size={20}/><div><div className="learn-eyebrow">Completed learning</div><h2 className="mt-1 text-lg font-bold">Congratulations</h2></div></div><p className="mt-3 text-sm text-slate-400">You have completed {completedCourses.length} course{completedCourses.length === 1 ? "" : "s"}. Certificates are available separately when you are eligible.</p><Link to="/learn/certificates" className="learn-secondary-button mt-4">View certificates <ArrowRight size={14}/></Link></section>}
    </>}
  </LearnShell>;
}
