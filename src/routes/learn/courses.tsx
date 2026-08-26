import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, Bot, BriefcaseBusiness, Headphones, Linkedin, Rocket } from "lucide-react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/learn/courses")({ component: Courses });

type Course = { id: string; slug: string; title: string; description: string | null; thumbnail_url: string | null; status: string };
const fallbackCourses: Array<[string,string,typeof Bot]> = [
  ["Learn AI Agents from Scratch", "Build working AI agents, voice agents and automations with n8n, Bolna AI and ChatGPT.", Bot],
  ["Increase Productivity at Work", "Replace repetitive workflows with agentic automations.", BriefcaseBusiness],
  ["Build AI Side Hustles", "Package new skills into freelance offers and productised services.", Rocket],
  ["Grow Your LinkedIn Brand", "Positioning, content systems and visibility strategies.", Linkedin],
  ["Prepare for AI-Era Careers", "Portfolio projects, interview readiness and AI-adjacent career narratives.", Headphones],
];

function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");

  useEffect(() => {
    async function loadCourses() {
      const { data, error } = await supabase.from("courses").select("id, slug, title, description, thumbnail_url, status").eq("status", "published").order("created_at", { ascending: false });
      if (error) setDbError(error.message); else setCourses((data ?? []) as Course[]);
      setLoading(false);
    }
    void loadCourses();
  }, []);

  return <LearnShell><SectionHeader eyebrow="My learning" title="Courses" description="Your enrolled learning paths and practical AI skill-building programs."/>
    {loading ? <div className="learn-card p-6 text-sm text-slate-400">Loading courses...</div> : dbError ? <div className="learn-card p-6 text-sm text-red-300">Unable to load courses right now.</div> : courses.length === 0 ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{fallbackCourses.map(([t,d,I]) => <div className="learn-card p-6" key={t}><div className="learn-icon-tile"><I size={20}/></div><h2 className="mt-5 text-lg font-bold">{t}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{d}</p><Link to="/learn" className="learn-secondary-button mt-5 w-full">Continue <ArrowUpRight size={15}/></Link></div>)}</div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{courses.map(course => <article className="learn-card overflow-hidden" key={course.id}>{course.thumbnail_url ? <img src={course.thumbnail_url} alt="" className="h-40 w-full object-cover"/> : <div className="flex h-40 items-center justify-center bg-gradient-to-br from-cyan-500/15 via-violet-500/15 to-orange-500/15"><BookOpen size={38} className="text-cyan-300/70"/></div>}<div className="p-6"><h2 className="text-lg font-bold">{course.title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{course.description || "Explore this learning path."}</p><Link to="/learn/courses/$slug" params={{slug: course.slug}} className="learn-secondary-button mt-5 w-full">View course <ArrowUpRight size={15}/></Link></div></article>)}</div>}
  </LearnShell>;
}
