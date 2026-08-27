import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, MessageSquare, Search, Sparkles, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/")({ component: LearnHome });

type Course = { id: string; slug: string; title: string; description: string | null; thumbnail_url: string | null };
type Enrollment = { course_id: string; status: string };
type Card = Course & { totalLessons: number; completedLessons: number; progress: number; enrollmentStatus: string };
type FeedPost = { id: string; title: string | null; body: string; created_at: string };
type Workshop = { id: string; title: string; description: string | null; starts_at: string | null; ends_at: string | null; format: string | null };

function dateLabel(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "Date to be announced"; }
function timeLabel(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "Time to be announced"; }

function LearnHome() {
  const [courses, setCourses] = useState<Card[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadLearning() {
      setLoading(true); setError("");
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { if (mounted) { setError("Your session could not be loaded."); setLoading(false); } return; }
      const [enrollmentResult, feedResult, workshopResult] = await Promise.all([
        supabase.from("enrollments").select("course_id, status").eq("user_id", user.id).in("status", ["active", "completed"]),
        supabase.from("feed_posts").select("id,title,body,created_at").order("created_at", { ascending: false }).limit(5),
        // meeting_url is not part of the current LMS workshop schema; links can be added
        // when that field is introduced rather than making the whole Feed query fail.
        supabase.from("workshops").select("id,title,description,starts_at,ends_at,format").eq("status", "upcoming").order("starts_at", { ascending: true }).limit(3),
      ]);
      if (feedResult.error) setError(feedResult.error.message);
      if (workshopResult.error) setError(workshopResult.error.message);
      if (enrollmentResult.error) setError(enrollmentResult.error.message);
      if (!mounted) return;
      setPosts((feedResult.data ?? []) as FeedPost[]); setWorkshops((workshopResult.data ?? []) as Workshop[]);
      const rows = (enrollmentResult.data ?? []) as Enrollment[];
      const courseIds = rows.map((row) => row.course_id);
      if (!courseIds.length) { setCourses([]); setLoading(false); return; }
      const { data: courseRows, error: courseError } = await supabase.from("courses").select("id, slug, title, description, thumbnail_url").in("id", courseIds).eq("status", "published");
      if (courseError) { if (mounted) { setError(courseError.message); setLoading(false); } return; }
      const { data: modules, error: moduleError } = await supabase.from("course_modules").select("id, course_id").in("course_id", courseIds);
      if (moduleError) { if (mounted) { setError(moduleError.message); setLoading(false); } return; }
      const moduleRows = (modules ?? []) as Array<{ id: string; course_id: string }>;
      const moduleIds = moduleRows.map((module) => module.id);
      let lessonRows: Array<{ id: string; module_id: string }> = [];
      if (moduleIds.length) { const { data, error: lessonError } = await supabase.from("course_lessons").select("id, module_id").in("module_id", moduleIds); if (lessonError) { if (mounted) { setError(lessonError.message); setLoading(false); } return; } lessonRows = (data ?? []) as Array<{ id: string; module_id: string }>; }
      let progressRows: Array<{ lesson_id: string; completed: boolean }> = [];
      if (lessonRows.length) { const { data, error: progressError } = await supabase.from("lesson_progress").select("lesson_id, completed").eq("user_id", user.id).in("lesson_id", lessonRows.map((lesson) => lesson.id)); if (progressError) { if (mounted) { setError(progressError.message); setLoading(false); } return; } progressRows = (data ?? []) as Array<{ lesson_id: string; completed: boolean }>; }
      const completed = new Set(progressRows.filter((row) => row.completed).map((row) => row.lesson_id));
      const moduleCourse = new Map(moduleRows.map((module) => [module.id, module.course_id]));
      const totals = new Map<string, number>(); const done = new Map<string, number>();
      for (const lesson of lessonRows) { const courseId = moduleCourse.get(lesson.module_id); if (!courseId) continue; totals.set(courseId, (totals.get(courseId) ?? 0) + 1); if (completed.has(lesson.id)) done.set(courseId, (done.get(courseId) ?? 0) + 1); }
      const enrollmentMap = new Map(rows.map((row) => [row.course_id, row.status]));
      const cards = ((courseRows ?? []) as Course[]).map((course) => { const totalLessons = totals.get(course.id) ?? 0; const completedLessons = done.get(course.id) ?? 0; const progress = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0; return { ...course, totalLessons, completedLessons, progress, enrollmentStatus: enrollmentMap.get(course.id) ?? "active" }; });
      if (mounted) { setCourses(cards); setLoading(false); }
    }
    void loadLearning(); return () => { mounted = false; };
  }, []);

  const inProgress = useMemo(() => courses.filter((course) => course.progress > 0 && course.progress < 100), [courses]);
  const completed = useMemo(() => courses.filter((course) => course.progress >= 100 || course.enrollmentStatus === "completed"), [courses]);
  const nextCourse = inProgress[0] ?? courses.find((course) => course.progress === 0) ?? null;

  return <LearnShell>
    <SectionHeader eyebrow="Feed" title="Welcome back" description="Your latest learning updates, upcoming workshops and enrolled courses." action={<Link to="/learn/courses" className="learn-secondary-button"><Search size={15}/> Browse courses</Link>} />
    {error && <div className="learn-alert error mb-5">Some learning data could not be loaded. You can still use the available sections below.</div>}
    <section className="mb-6"><div className="mb-3 flex items-end justify-between"><div><div className="learn-eyebrow">Upcoming workshops</div><h2 className="mt-1 text-xl font-bold">Join the next live session</h2></div><Link to="/learn/workshops" className="text-xs font-semibold text-amber-600">View all</Link></div>{workshops.length ? <div className="space-y-3">{workshops.map((workshop) => <article key={workshop.id} className="reference-workshop-card upcoming"><div className="reference-workshop-grid"><div><div className="reference-workshop-status"><Video size={13}/> Upcoming workshop</div><h3 className="mt-2 text-lg font-bold">{workshop.title}</h3><p className="mt-1 text-sm leading-6">{workshop.description || "A live practical session from Coach Amit Soni."}</p><div className="reference-workshop-meta"><span><CalendarDays size={13}/>{dateLabel(workshop.starts_at)}</span><span><Clock3 size={13}/>{timeLabel(workshop.starts_at)}</span><span><Video size={13}/>{workshop.format || "Online"}</span></div></div><div className="reference-workshop-actions"><Link to="/learn/workshops" className="reference-register-button">View details <ArrowRight size={13}/></Link></div></div></article>)}</div> : <div className="learn-card p-5 text-sm">No upcoming workshops are scheduled yet.</div>}</section>
    <section className="mb-6"><div className="mb-3 flex items-end justify-between"><div><div className="learn-eyebrow">Latest from Amit</div><h2 className="mt-1 text-xl font-bold">Feed</h2></div></div>{posts.length ? <div className="grid gap-3 md:grid-cols-2">{posts.map((post) => <article key={post.id} className="learn-card p-5"><div className="flex items-start gap-3"><div className="learn-avatar">AS</div><div className="min-w-0"><h3 className="font-bold">{post.title || "Learning update"}</h3><p className="mt-2 text-sm leading-6">{post.body}</p><div className="mt-3 text-[10px] text-slate-500">Amit Soni · {new Date(post.created_at).toLocaleDateString()}</div></div></div></article>)}</div> : <div className="learn-card p-5 text-sm">No feed updates have been published yet.</div>}</section>
    {loading ? <div className="learn-card p-8 text-sm">Loading your learning...</div> : courses.length === 0 ? <div className="learn-card learn-empty"><div className="mx-auto learn-icon-tile"><BookOpen size={20}/></div><h2 className="mt-5 text-xl font-bold">Your learning starts here</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6">You don't have an active course enrolment yet. Browse the available courses or contact the learning team.</p><Link to="/learn/courses" className="learn-primary-button mt-5">Explore courses <ArrowRight size={16}/></Link></div> : <>
      {nextCourse && <section className="learn-continue-card"><div><div className="learn-eyebrow">Continue learning</div><h2 className="mt-2 text-2xl font-bold">{nextCourse.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{nextCourse.description || "Continue your learning path from your latest progress."}</p><div className="mt-5 flex max-w-xl items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${nextCourse.progress}%` }}/></div><span className="text-sm font-bold">{nextCourse.progress}%</span></div></div><Link to="/learn/courses/$slug" params={{slug: nextCourse.slug}} className="learn-primary-button shrink-0">{nextCourse.progress ? "Continue" : "Start learning"}<ArrowRight size={16}/></Link></section>}
      <div className="mb-5 grid gap-4 sm:grid-cols-3"><div className="learn-stat-card"><div className="learn-stat-label">Enrolled courses</div><div className="learn-stat-value">{courses.length}</div></div><div className="learn-stat-card"><div className="learn-stat-label">In progress</div><div className="learn-stat-value">{inProgress.length}</div></div><div className="learn-stat-card"><div className="learn-stat-label">Completed</div><div className="learn-stat-value">{completed.length}</div></div></div>
      <div className="mb-3 flex items-center justify-between"><div><div className="learn-eyebrow">Your courses</div><h2 className="mt-1 text-xl font-bold">Keep learning</h2></div><Link to="/learn/courses" className="text-xs font-semibold text-amber-600">View all</Link></div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{courses.slice(0,6).map((course) => <article className="learn-course-card" key={course.id}><div className="learn-course-image">{course.thumbnail_url ? <img src={course.thumbnail_url} alt=""/> : <div className="learn-course-placeholder"><Sparkles size={34}/></div>}{(course.progress >= 100 || course.enrollmentStatus === "completed") && <span className="learn-course-badge"><CheckCircle2 size={13}/> Completed</span>}</div><div className="p-5"><h3 className="line-clamp-2 text-base font-bold leading-6">{course.title}</h3><div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>{course.completedLessons}/{course.totalLessons} lectures</span><span className="font-semibold text-slate-200">{course.progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${course.progress}%` }}/></div><Link to="/learn/courses/$slug" params={{slug: course.slug}} className="learn-course-action mt-4">{course.progress >= 100 ? "View course" : "Continue"}<ArrowRight size={15}/></Link></div></article>)}</div>
    </>}
    <div className="mt-6 learn-card p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="learn-eyebrow">Need help?</div><h2 className="mt-1 text-base font-bold">Questions or feedback?</h2><p className="mt-1 text-sm text-slate-400">Message the learning team about your course, workshop or access.</p></div><Link to="/learn/messages" className="learn-secondary-button"><MessageSquare size={15}/> Open messages</Link></div></div>
  </LearnShell>;
}
