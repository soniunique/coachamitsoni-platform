import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Course = { id: string; title: string; slug: string; status: string };

export const Route = createFileRoute("/learn/manage/enrolments")({ component: EnrolmentManager });

function EnrolmentManager() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You are not signed in."); setLoading(false); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) { setError(profileError.message); setLoading(false); return; }
    if (profile?.role !== "admin") { setError("Only admins can manage enrolments."); setLoading(false); return; }
    setIsAdmin(true);
    const { data, error: courseError } = await supabase.from("courses").select("id, title, slug, status").order("created_at", { ascending: false });
    if (courseError) setError(courseError.message); else setCourses((data ?? []) as Course[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <LearnShell><div className="learn-card flex items-center gap-3 p-6 text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading courses...</div></LearnShell>;

  return <LearnShell>
    <SectionHeader eyebrow="Admin" title="Enrolments" description="Choose a course to manage which student accounts have access." />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {!isAdmin ? null : courses.length === 0 ? <div className="learn-card p-8 text-center text-sm text-slate-400">No courses are available yet.</div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{courses.map(course => <article key={course.id} className="learn-card p-6"><div className="learn-icon-tile"><Users size={19}/></div><div className="mt-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{course.title}</h2><p className="mt-1 text-xs text-slate-500">{course.slug}</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{course.status}</span></div><p className="mt-4 text-sm text-slate-400">Manage student enrolment and course access.</p><Link to="/learn/manage/course-students/$courseId" params={{ courseId: course.id }} className="learn-primary-button mt-5 w-full justify-center">Manage students <ArrowRight size={16}/></Link></article>)}</div>}
  </LearnShell>;
}
