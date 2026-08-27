import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, CheckCircle2, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/courses")({ component: Courses });

type Course = { id: string; slug: string; title: string; description: string | null; thumbnail_url: string | null; status: string };
type Enrollment = { course_id: string; status: string };
type CourseCard = Course & { totalSections: number; totalLessons: number; completedLessons: number; progress: number; enrollmentStatus: string | null };
type Filter = "all" | "in-progress" | "completed" | "expired" | "paid" | "service" | "duration";

function Courses() {
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setDbError("");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) { setDbError("Your session could not be loaded."); setLoading(false); }
        return;
      }

      // Only use columns that exist in the current LMS schema. Published courses are
      // intentionally visible to every authenticated student; enrolment controls lesson access.
      const { data: published, error } = await supabase
        .from("courses")
        .select("id, slug, title, description, thumbnail_url, status")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) {
        if (mounted) { setDbError(error.message); setLoading(false); }
        return;
      }

      const base = (published ?? []) as Course[];
      if (!base.length) {
        if (mounted) { setCourses([]); setLoading(false); }
        return;
      }

      const ids = base.map((c) => c.id);
      const [{ data: ens }, { data: mods }] = await Promise.all([
        supabase.from("enrollments").select("course_id, status").eq("user_id", user.id).in("course_id", ids).in("status", ["active", "completed", "cancelled"]),
        supabase.from("course_modules").select("id, course_id").in("course_id", ids),
      ]);

      const moduleRows = (mods ?? []) as Array<{ id: string; course_id: string }>;
      const moduleIds = moduleRows.map((m) => m.id);
      let lessons: Array<{ id: string; module_id: string }> = [];
      if (moduleIds.length) {
        const { data: lessonRows, error: lessonError } = await supabase
          .from("course_lessons")
          .select("id, module_id")
          .in("module_id", moduleIds);
        if (lessonError) {
          if (mounted) { setDbError(lessonError.message); setLoading(false); }
          return;
        }
        lessons = (lessonRows ?? []) as Array<{ id: string; module_id: string }>;
      }

      const lessonIds = lessons.map((l) => l.id);
      let progress: Array<{ lesson_id: string; completed: boolean }> = [];
      if (lessonIds.length) {
        const { data: progressRows, error: progressError } = await supabase
          .from("lesson_progress")
          .select("lesson_id, completed")
          .eq("user_id", user.id)
          .in("lesson_id", lessonIds);
        if (progressError) {
          if (mounted) { setDbError(progressError.message); setLoading(false); }
          return;
        }
        progress = (progressRows ?? []) as Array<{ lesson_id: string; completed: boolean }>;
      }

      const done = new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id));
      const enrollmentMap = new Map(((ens ?? []) as Enrollment[]).map((e) => [e.course_id, e.status]));
      const moduleCourseMap = new Map(moduleRows.map((m) => [m.id, m.course_id]));
      const totalLessons = new Map<string, number>();
      const completedLessons = new Map<string, number>();
      for (const lesson of lessons) {
        const courseId = moduleCourseMap.get(lesson.module_id);
        if (!courseId) continue;
        totalLessons.set(courseId, (totalLessons.get(courseId) ?? 0) + 1);
        if (done.has(lesson.id)) completedLessons.set(courseId, (completedLessons.get(courseId) ?? 0) + 1);
      }

      const totalSections = new Map<string, number>();
      for (const module of moduleRows) totalSections.set(module.course_id, (totalSections.get(module.course_id) ?? 0) + 1);

      const cards = base.map((course) => {
        const total = totalLessons.get(course.id) ?? 0;
        const finished = completedLessons.get(course.id) ?? 0;
        const progressPercent = total ? Math.round((finished / total) * 100) : 0;
        return {
          ...course,
          totalSections: totalSections.get(course.id) ?? 0,
          totalLessons: total,
          completedLessons: finished,
          progress: progressPercent,
          enrollmentStatus: enrollmentMap.get(course.id) ?? null,
        };
      });
      if (mounted) { setCourses(cards); setLoading(false); }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => courses.filter((course) => {
    const text = `${course.title} ${course.description ?? ""}`.toLowerCase();
    if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
    if (filter === "in-progress") return course.enrollmentStatus !== "cancelled" && Boolean(course.enrollmentStatus) && course.progress > 0 && course.progress < 100;
    if (filter === "completed") return course.progress >= 100 || course.enrollmentStatus === "completed";
    if (filter === "expired") return course.enrollmentStatus === "cancelled";
    // Payment/service/duration filters are retained visually for the reference UX.
    // Those metadata fields are not yet part of the current LMS schema, so they do not
    // invent or infer catalogue data.
    if (filter === "paid" || filter === "service" || filter === "duration") return false;
    return true;
  }), [courses, filter, query]);

  return <LearnShell>
    <SectionHeader eyebrow="Courses" title="Courses" description="Explore all available learning paths and pick up exactly where you left off." />
    <div className="learn-course-toolbar">
      <label className="learn-search-wrap">
        <Search size={17} />
        <input className="learn-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by course title or description" aria-label="Search courses" />
      </label>
    </div>
    <div className="learn-filter-row" role="tablist" aria-label="Course filters">
      {([['all', 'All'], ['in-progress', 'In progress'], ['completed', 'Completed'], ['expired', 'Expired'], ['paid', 'Paid'], ['service', 'Service'], ['duration', 'Duration']] as const).map(([value, label]) => (
        <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`learn-filter-tab ${filter === value ? 'active' : ''}`}>{label}</button>
      ))}
    </div>

    {loading ? <div className="learn-card p-8 text-sm">Loading your courses...</div> :
      dbError ? <div className="learn-alert error">Unable to load your courses right now.</div> :
      filtered.length === 0 ? <div className="learn-card learn-empty"><div className="mx-auto learn-icon-tile"><BookOpen size={20} /></div><h2 className="mt-5 text-xl font-bold">{courses.length ? 'No courses match this view' : 'No courses available yet'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6">{courses.length ? 'Try another filter or search term.' : 'Your published learning paths will appear here when they are available.'}</p></div> :
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((course) => {
          const expired = course.enrollmentStatus === "cancelled";
          const enrolled = Boolean(course.enrollmentStatus) && !expired;
          const complete = !expired && (course.progress >= 100 || course.enrollmentStatus === "completed");
          const started = enrolled && course.progress > 0 && !complete;
          const action = expired ? "Expired" : complete ? "View course" : started ? "Continue" : "Start learning";
          return <article className="learn-course-card" key={course.id}>
            <div className="learn-course-image">
              {course.thumbnail_url ? <img src={course.thumbnail_url} alt="" /> : <div className="learn-course-placeholder"><Sparkles size={34} /></div>}
              {complete && <span className="learn-course-badge"><CheckCircle2 size={13} /> Completed</span>}
            </div>
            <div className="p-5">
              <h2 className="mt-1 line-clamp-2 text-lg font-bold leading-6">{course.title}</h2>
              <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5">{course.description || 'Explore this practical learning path.'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span>{course.totalSections} sections</span><span>•</span><span>{course.totalLessons} lectures</span>{course.enrollmentStatus && <><span>•</span><span>{course.completedLessons}/{course.totalLessons} complete</span></>}</div>
              {(started || complete) && <><div className="mt-4 flex items-center justify-between text-xs"><span>Progress</span><span className="font-semibold">{course.progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="learn-progress-fill h-full rounded-full" style={{ width: `${course.progress}%` }} /></div></>}
              {expired && <div className="mt-4 text-xs font-semibold text-slate-500">Enrollment expired</div>}
              {complete && <div className="mt-3 flex items-center justify-between text-xs"><span className="font-semibold text-emerald-600">100% complete</span><span className="text-slate-500">Ready to review</span></div>}
              <Link to="/learn/courses/$slug" params={{ slug: course.slug }} className={`learn-course-action mt-5 ${expired ? 'opacity-60' : ''}`}>{action}<ArrowRight size={16} /></Link>
            </div>
          </article>;
        })}
      </div>}
    <div className="mt-5 flex items-center gap-2 text-xs"><span>Course progress is based on completed lectures.</span></div>
  </LearnShell>;
}
