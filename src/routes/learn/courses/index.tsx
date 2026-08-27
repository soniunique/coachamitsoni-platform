import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/courses")({ component: Courses });

type Course = { id: string; slug: string; title: string; description: string | null; thumbnail_url: string | null; status: string };
type Enrollment = { course_id: string; status: string };
type CourseCard = Course & { totalLessons: number; completedLessons: number; progress: number; enrollmentStatus: string | null };
type Filter = "all" | "in-progress" | "completed" | "not-started";

function Courses() {
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let mounted = true;
    async function loadCourses() {
      setLoading(true); setDbError("");
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { if (mounted) { setDbError("Your session could not be loaded."); setLoading(false); } return; }

      const { data: published, error: courseError } = await supabase.from("courses").select("id, slug, title, description, thumbnail_url, status").eq("status", "published").order("created_at", { ascending: false });
      if (courseError) { if (mounted) { setDbError(courseError.message); setLoading(false); } return; }
      const baseCourses = (published ?? []) as Course[];
      if (!baseCourses.length) { if (mounted) setCourses([]); setLoading(false); return; }

      const courseIds = baseCourses.map((course) => course.id);
      const [{ data: enrollments }, { data: modules }, { data: lessons }] = await Promise.all([
        supabase.from("enrollments").select("course_id, status").eq("user_id", user.id).in("course_id", courseIds),
        supabase.from("course_modules").select("id, course_id").in("course_id", courseIds),
        supabase.from("course_lessons").select("id, module_id").in("module_id", ["00000000-0000-0000-0000-000000000000"]),
      ]);

      const loadedEnrollments = (enrollments ?? []) as Enrollment[];
      const moduleRows = (modules ?? []) as Array<{ id: string; course_id: string }>;
      const moduleIds = moduleRows.map((module) => module.id);
      let lessonRows: Array<{ id: string; module_id: string }> = [];
      if (moduleIds.length) {
        const { data } = await supabase.from("course_lessons").select("id, module_id").in("module_id", moduleIds);
        lessonRows = (data ?? []) as Array<{ id: string; module_id: string }>;
      }
      const lessonIds = lessonRows.map((lesson) => lesson.id);
      let progressRows: Array<{ lesson_id: string; completed: boolean }> = [];
      if (lessonIds.length) {
        const { data } = await supabase.from("lesson_progress").select("lesson_id, completed").eq("user_id", user.id).in("lesson_id", lessonIds);
        progressRows = (data ?? []) as Array<{ lesson_id: string; completed: boolean }>;
      }
      const completed = new Set(progressRows.filter((row) => row.completed).map((row) => row.lesson_id));
      const enrollmentMap = new Map(loadedEnrollments.map((row) => [row.course_id, row.status]));
      const moduleCourse = new Map(moduleRows.map((module) => [module.id, module.course_id]));
      const totals = new Map<string, number>();
      const done = new Map<string, number>();
      for (const lesson of lessonRows) {
        const courseId = moduleCourse.get(lesson.module_id);
        if (!courseId) continue;
        totals.set(courseId, (totals.get(courseId) ?? 0) + 1);
        if (completed.has(lesson.id)) done.set(courseId, (done.get(courseId) ?? 0) + 1);
      }
      const cards = baseCourses.map((course) => {
        const totalLessons = totals.get(course.id) ?? 0;
        const completedLessons = done.get(course.id) ?? 0;
        const progress = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
        return { ...course, totalLessons, completedLessons, progress, enrollmentStatus: enrollmentMap.get(course.id) ?? null };
      });
      if (mounted) { setCourses(cards); setLoading(false); }
    }
    void loadCourses();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => courses.filter((course) => {
    const text = `${course.title} ${course.description ?? ""}`.toLowerCase();
    if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
    if (filter === "in-progress") return course.enrollmentStatus === "active" && course.progress > 0 && course.progress < 100;
    if (filter === "completed") return course.progress >= 100 || course.enrollmentStatus === "completed";
    if (filter === "not-started") return !course.enrollmentStatus || course.progress === 0;
    return true;
  }), [courses, filter, query]);

  const enrolledCount = courses.filter((course) => Boolean(course.enrollmentStatus)).length;
  const completedCount = courses.filter((course) => course.progress >= 100 || course.enrollmentStatus === "completed").length;

  return <LearnShell>
    <SectionHeader eyebrow="My learning" title="Courses" description="Find your learning paths, see your progress, and continue exactly where you left off." />

    <div className="learn-course-toolbar">
      <label className="learn-search-wrap"><Search size={17}/><input className="learn-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by course title or description" aria-label="Search courses" /></label>
      <div className="learn-course-summary"><span>{enrolledCount} enrolled</span><span>{completedCount} completed</span></div>
    </div>
    <div className="learn-filter-row" role="tablist" aria-label="Course filters">
      {([['all','All'],['in-progress','In progress'],['completed','Completed'],['not-started','Not started']] as const).map(([value,label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`learn-filter-tab ${filter === value ? "active" : ""}`}>{label}</button>)}
    </div>

    {loading ? <div className="learn-card p-8 text-sm text-slate-400">Loading your courses...</div> : dbError ? <div className="learn-alert error">Unable to load your courses right now.</div> : filtered.length === 0 ? <div className="learn-card learn-empty"><div className="mx-auto learn-icon-tile"><BookOpen size={20}/></div><h2 className="mt-5 text-xl font-bold">{courses.length ? "No courses match this view" : "No courses available yet"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{courses.length ? "Try another filter or search term." : "Your published learning paths will appear here when they are available."}</p></div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((course) => {
      const enrolled = Boolean(course.enrollmentStatus);
      const complete = course.progress >= 100 || course.enrollmentStatus === "completed";
      return <article className="learn-course-card" key={course.id}>
        <div className="learn-course-image">{course.thumbnail_url ? <img src={course.thumbnail_url} alt="" /> : <div className="learn-course-placeholder"><Sparkles size={34}/></div>}{complete && <span className="learn-course-badge"><CheckCircle2 size={13}/> Completed</span>}</div>
        <div className="p-5 sm:p-6"><div className="flex items-center gap-2 text-[11px] text-slate-500"><span>{course.totalLessons} lessons</span><span>•</span><span>{enrolled ? (complete ? "Completed" : "Enrolled") : "Available"}</span></div><h2 className="mt-2 line-clamp-2 text-lg font-bold leading-6">{course.title}</h2><p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">{course.description || "Explore this practical learning path."}</p>
          {enrolled && <><div className="mt-5 flex items-center justify-between text-xs"><span className="text-slate-400">Your progress</span><span className="font-semibold text-slate-200">{course.progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all" style={{ width: `${course.progress}%` }}/></div></>}
          <Link to="/learn/courses/$slug" params={{slug: course.slug}} className="learn-course-action mt-5">{complete ? "Review course" : enrolled ? "Continue learning" : "View course"}<ArrowRight size={16}/></Link>
        </div>
      </article>;
    })}</div>}
    <div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14}/> Progress is calculated from your completed lessons.</div>
  </LearnShell>;
}
