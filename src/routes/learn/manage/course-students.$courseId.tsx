import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Loader2, Search, UserPlus, UserRoundX, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Course = { id: string; title: string; slug: string; status: string };
type Student = { id: string; email: string; full_name: string };
type RosterRow = Student & { enrollment_id: string | null; enrollment_status: string | null; progress_percent: number | null; enrolled_at: string | null; completed_at: string | null };

export const Route = createFileRoute("/learn/manage/course-students/$courseId")({ component: CourseStudentsManager });

function CourseStudentsManager() {
  const { courseId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You are not signed in."); setLoading(false); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) { setError(profileError.message); setLoading(false); return; }
    if (profile?.role !== "admin") { setError("Only admins can manage course enrolments."); setLoading(false); return; }

    const [{ data: courseData, error: courseError }, { data: studentData, error: studentError }, { data: rosterData, error: rosterError }] = await Promise.all([
      supabase.from("courses").select("id, title, slug, status").eq("id", courseId).maybeSingle(),
      supabase.rpc("admin_list_students"),
      supabase.rpc("admin_get_course_roster", { p_course_id: courseId }),
    ]);
    if (courseError || !courseData) { setError(courseError?.message ?? "Course not found."); setLoading(false); return; }
    if (studentError) { setError(studentError.message); setLoading(false); return; }
    if (rosterError) { setError(rosterError.message); setLoading(false); return; }
    setCourse(courseData as Course); setStudents((studentData ?? []) as Student[]);
    setRoster(((rosterData ?? []) as Array<Omit<RosterRow, "id"> & { student_id: string }>).map(student => ({ ...student, id: student.student_id })));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [courseId]);

  const filteredRoster = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roster;
    return roster.filter(student => `${student.full_name} ${student.email}`.toLowerCase().includes(query));
  }, [roster, search]);

  async function setEnrollment(studentId: string, enrolled: boolean) {
    if (!studentId) { setError("Student account ID is missing; enrolment was not submitted."); return; }
    setSavingId(studentId); setError(""); setSuccess("");
    const { error: actionError } = await supabase.rpc("admin_set_course_enrollment", { p_course_id: courseId, p_user_id: studentId, p_enrolled: enrolled });
    if (actionError) setError(actionError.message); else { setSuccess(enrolled ? "Student enrolled in the complete course." : "Student un-enrolled from the course."); await load(); }
    setSavingId(null);
  }

  async function unenrol(student: RosterRow) {
    if (!window.confirm(`Un-enrol ${student.full_name || student.email} from this course? They will lose access to all restricted lessons in this course.`)) return;
    await setEnrollment(student.id, false);
  }

  const activeCount = roster.filter(student => student.enrollment_status === "active" || student.enrollment_status === "completed").length;

  if (loading) return <LearnShell><div className="learn-card flex items-center gap-3 p-6 text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading course enrolments...</div></LearnShell>;
  if (!course) return <LearnShell><div className="learn-card p-6"><Link to="/learn/manage/courses" className="learn-secondary-button"><ArrowLeft size={15}/>Back to Course Manager</Link><p className="mt-6 text-sm text-red-300">{error || "Course unavailable."}</p></div></LearnShell>;

  return <LearnShell>
    <div className="mb-5"><Link to="/learn/manage/courses" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15}/>Back to Course Manager</Link></div>
    <SectionHeader eyebrow="Admin · Course students" title={course.title} description="Course-level access only. Enrolling a student gives read-only access to every module and lesson in this course." />
    <div className="mb-6 flex flex-wrap gap-2"><Link to="/learn/manage/course-content/$courseId" params={{ courseId }} className="learn-secondary-button"><Users size={15}/>Content</Link><span className="learn-primary-button"><Users size={15}/>Students</span></div>
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {success && <div className="learn-card mb-5 border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}

    <div className="grid gap-5 md:grid-cols-3 mb-6">
      <div className="learn-card p-5"><div className="text-xs uppercase tracking-[.16em] text-slate-500">Students</div><div className="mt-2 text-2xl font-bold">{students.length}</div><div className="mt-1 text-xs text-slate-500">registered student accounts</div></div>
      <div className="learn-card p-5"><div className="text-xs uppercase tracking-[.16em] text-slate-500">Enrolled</div><div className="mt-2 text-2xl font-bold">{activeCount}</div><div className="mt-1 text-xs text-slate-500">active course enrolments</div></div>
      <div className="learn-card p-5"><div className="text-xs uppercase tracking-[.16em] text-slate-500">Access rule</div><div className="mt-2 text-sm font-semibold">Whole course · read only</div><div className="mt-1 text-xs text-slate-500">No module-level enrolment or content editing for students.</div></div>
    </div>

    <div className="learn-card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="learn-eyebrow">Course roster</div><h2 className="mt-1 text-xl font-bold">Manage student access</h2></div><div className="relative w-full sm:w-80"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-4 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="Search name or email"/></div></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-[.12em] text-slate-500"><th className="px-3 py-3">Student</th><th className="px-3 py-3">Course access</th><th className="px-3 py-3">Progress</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
      <tbody>{filteredRoster.map(student=>{const active=student.enrollment_status==='active'; const completed=student.enrollment_status==='completed'; const hasAccess=active||completed; const busy=savingId===student.id; return <tr key={student.id} className="border-b border-white/6 last:border-0"><td className="px-3 py-4"><div className="font-semibold">{student.full_name||"Unnamed student"}</div><div className="mt-1 text-xs text-slate-500">{student.email}</div></td><td className="px-3 py-4">{active?<span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300"><CheckCircle2 size={13}/>Full course</span>:completed?<span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-300"><CheckCircle2 size={13}/>Completed</span>:<span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">No access</span>}</td><td className="px-3 py-4 text-slate-400">{hasAccess?`${Number(student.progress_percent??0).toFixed(0)}%`:"—"}</td><td className="px-3 py-4 text-right">{hasAccess?<button type="button" className="learn-secondary-button" disabled={busy} onClick={()=>void unenrol(student)}>{busy?<Loader2 size={15} className="animate-spin"/>:<UserRoundX size={15}/>}Un-enrol</button>:<button type="button" className="learn-primary-button" disabled={busy} onClick={()=>void setEnrollment(student.id,true)}>{busy?<Loader2 size={15} className="animate-spin"/>:<UserPlus size={15}/>}Enrol full course</button>}</td></tr>})}</tbody></table>{filteredRoster.length===0&&<div className="py-10 text-center text-sm text-slate-500">No student accounts match your search.</div>}</div>
    </div>
  </LearnShell>;
}
