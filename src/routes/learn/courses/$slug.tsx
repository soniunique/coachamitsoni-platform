import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, CheckCircle2, CirclePlay, Loader2, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/courses/$slug")({ component: CourseDetail });

type Course = { id: string; slug: string; title: string; description: string | null; thumbnail_url: string | null; status: string };
type Module = { id: string; title: string; description: string | null; sort_order: number };
type Lesson = { id: string; module_id: string; title: string; description: string | null; content_url: string | null; content_type: string | null; sort_order: number; is_preview: boolean };

function CourseDetail() {
  const { slug } = Route.useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCourse() {
      setLoading(true); setError("");
      const { data: courseData, error: courseError } = await supabase.from("courses").select("id, slug, title, description, thumbnail_url, status").eq("slug", slug).eq("status", "published").maybeSingle();
      if (courseError || !courseData) { setError(courseError?.message ?? "Course not found."); setLoading(false); return; }
      setCourse(courseData as Course);
      const { data: moduleData, error: moduleError } = await supabase.from("course_modules").select("id, title, description, sort_order").eq("course_id", courseData.id).order("sort_order", { ascending: true });
      if (moduleError) { setError(moduleError.message); setLoading(false); return; }
      const loadedModules = (moduleData ?? []) as Module[]; setModules(loadedModules);
      const { data: lessonData, error: lessonError } = await supabase.from("course_lessons").select("id, module_id, title, description, content_url, content_type, sort_order, is_preview").in("module_id", loadedModules.map(m=>m.id).length ? loadedModules.map(m=>m.id) : ["00000000-0000-0000-0000-000000000000"]).order("sort_order", { ascending: true });
      if (lessonError) { setError(lessonError.message); setLoading(false); return; }
      setLessons((lessonData ?? []) as Lesson[]);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: enrollment } = await supabase.from("enrollments").select("id, status").eq("user_id", user.id).eq("course_id", courseData.id).in("status", ["active", "completed"]).maybeSingle();
        setEnrolled(Boolean(enrollment));
        const lessonIds = (lessonData ?? []).map((lesson: Lesson) => lesson.id);
        if (lessonIds.length) { const { data: progress } = await supabase.from("lesson_progress").select("lesson_id, completed").eq("user_id", user.id).in("lesson_id", lessonIds); setCompleted(new Set((progress ?? []).filter((item: {completed:boolean})=>item.completed).map((item: {lesson_id:string})=>item.lesson_id))); }
      }
      setLoading(false);
    }
    void loadCourse();
  }, [slug]);

  if (loading) return <LearnShell><div className="learn-card flex items-center gap-3 p-6 text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading course...</div></LearnShell>;
  if (error || !course) return <LearnShell><div className="learn-card p-6"><Link to="/learn/courses" className="learn-secondary-button"><ArrowLeft size={15}/>Back to courses</Link><p className="mt-6 text-sm text-red-300">{error || "Course not found."}</p></div></LearnShell>;

  return <LearnShell><div className="mb-6"><Link to="/learn/courses" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15}/>Back to courses</Link></div>
    <section className="learn-card overflow-hidden">{course.thumbnail_url ? <img src={course.thumbnail_url} alt="" className="h-56 w-full object-cover"/> : <div className="h-56 bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-orange-500/20"/>}<div className="p-7"><div className="learn-eyebrow">Course</div><h1 className="mt-2 text-3xl font-bold tracking-tight">{course.title}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{course.description || "Work through the modules and lessons in this learning path."}</p><div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-400"><span className="rounded-full border border-white/10 px-3 py-1.5">{modules.length} module{modules.length === 1 ? "" : "s"}</span><span className="rounded-full border border-white/10 px-3 py-1.5">{lessons.length} lesson{lessons.length === 1 ? "" : "s"}</span><span className="rounded-full border border-white/10 px-3 py-1.5">{enrolled ? "Enrolled" : "Preview access"}</span></div></div></section>
    <div className="mt-6 space-y-4">{modules.length === 0 ? <div className="learn-card p-6 text-sm text-slate-400">Modules for this course have not been published yet.</div> : modules.map((module,index) => { const moduleLessons=lessons.filter(lesson=>lesson.module_id===module.id); return <section className="learn-card p-6" key={module.id}><div className="flex items-start gap-4"><div className="learn-icon-tile shrink-0"><BookOpen size={19}/></div><div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Module {index+1}</div><h2 className="mt-1 text-xl font-bold">{module.title}</h2>{module.description&&<p className="mt-2 text-sm leading-6 text-slate-400">{module.description}</p>}<div className="mt-5 space-y-2">{moduleLessons.length===0?<p className="text-sm text-slate-500">Lessons coming soon.</p>:moduleLessons.map((lesson,lessonIndex)=>{const accessible=enrolled||lesson.is_preview;return <div key={lesson.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.03] p-3"><div className="shrink-0 text-slate-500">{completed.has(lesson.id)?<CheckCircle2 size={18} className="text-emerald-400"/>:accessible?<CirclePlay size={18} className="text-cyan-300"/>:<LockKeyhole size={18}/>}</div><div className="min-w-0 flex-1"><div className="text-xs text-slate-500">Lesson {lessonIndex+1}{lesson.is_preview?" · Preview":""}</div><div className="truncate text-sm font-medium text-slate-200">{lesson.title}</div>{lesson.description&&<div className="truncate text-xs text-slate-500">{lesson.description}</div>}</div><span className="text-xs text-slate-500">{accessible?"Available":"Enrol to unlock"}</span></div>})}</div></div></div></section>})}</div>
    {!enrolled && lessons.some(lesson=>!lesson.is_preview) && <div className="mt-6 learn-card border border-cyan-400/20 bg-cyan-400/5 p-5 text-sm text-slate-300"><strong className="text-white">Want full access?</strong> Enrolment is required to unlock non-preview lessons. Your preview lessons remain available.</div>}
  </LearnShell>;
}
