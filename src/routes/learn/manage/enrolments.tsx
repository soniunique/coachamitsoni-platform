import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, Loader2, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Program = { id: string; title: string; slug: string; status: string };
type Student = { id: string; email: string; full_name: string };
type ProgramEnrollment = { user_id: string; program_id: string; status: string };

export const Route = createFileRoute("/learn/manage/enrolments")({ component: EnrolmentManager });

function EnrolmentManager() {
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<ProgramEnrollment[]>([]);
  const [search, setSearch] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You are not signed in."); setLoading(false); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) { setError(profileError.message); setLoading(false); return; }
    if (profile?.role !== "admin") { setError("Only admins can manage program access."); setLoading(false); return; }

    const [{ data: programData, error: programError }, { data: studentData, error: studentError }, { data: enrollmentData, error: enrollmentError }] = await Promise.all([
      supabase.from("programs").select("id, title, slug, status").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      supabase.rpc("admin_list_students"),
      supabase.from("program_enrollments").select("user_id, program_id, status"),
    ]);
    if (programError) { setError(programError.message); setLoading(false); return; }
    if (studentError) { setError(studentError.message); setLoading(false); return; }
    if (enrollmentError) { setError(enrollmentError.message); setLoading(false); return; }
    setPrograms((programData ?? []) as Program[]); setStudents((studentData ?? []) as Student[]); setEnrollments((enrollmentData ?? []) as ProgramEnrollment[]); setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter(student => `${student.full_name} ${student.email}`.toLowerCase().includes(query));
  }, [students, search]);

  function hasAccess(userId: string, programId: string) {
    return enrollments.some(e => e.user_id === userId && e.program_id === programId && (e.status === "active" || e.status === "completed"));
  }

  async function toggleProgram(student: Student, program: Program) {
    const key = `${student.id}:${program.id}`;
    setSavingKey(key); setError(""); setSuccess("");
    const currentlyEnrolled = hasAccess(student.id, program.id);
    const { error: mutationError } = await supabase.rpc("admin_set_program_enrollment", {
      p_program_id: program.id,
      p_user_id: student.id,
      p_enrolled: !currentlyEnrolled,
    });
    if (mutationError) {
      setError(mutationError.message);
    } else {
      setSuccess(`${program.title} access ${currentlyEnrolled ? "removed from" : "granted to"} ${student.full_name || student.email}.`);
      await load();
    }
    setSavingKey(null);
  }

  if (loading) return <LearnShell><div className="learn-card flex items-center gap-3 p-6 text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading program access...</div></LearnShell>;

  return <LearnShell>
    <SectionHeader eyebrow="Admin" title="Program Access" description="Grant a student access to a program. Access automatically includes every published course and lesson inside that program." action={<Link to="/learn/manage/courses" className="learn-secondary-button">Manage programs <ArrowUpRight size={15}/></Link>} />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {success && <div className="learn-card mb-5 border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}
    {programs.length === 0 ? <div className="learn-card p-8 text-center"><Users className="mx-auto text-cyan-300" size={32}/><h2 className="mt-4 text-lg font-bold">No programs available</h2><p className="mt-2 text-sm text-slate-400">Create a program before assigning student access.</p></div> : <div className="learn-card p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="learn-eyebrow">Student access matrix</div><h2 className="mt-1 text-xl font-bold">Assign programs</h2><p className="mt-2 text-sm text-slate-400">A checked program gives the student access to all courses currently in that program and any courses added later.</p></div><div className="relative w-full sm:w-80"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-4 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="Search student"/></div></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-[.12em] text-slate-500"><th className="sticky left-0 bg-[#0b1422] px-3 py-3">Student</th>{programs.map(program=><th key={program.id} className="px-3 py-3 text-center">{program.title}</th>)}</tr></thead><tbody>{filteredStudents.map(student=><tr key={student.id} className="border-b border-white/6 last:border-0"><td className="sticky left-0 bg-[#0b1422] px-3 py-4"><div className="font-semibold">{student.full_name || "Unnamed student"}</div><div className="mt-1 text-xs text-slate-500">{student.email}</div></td>{programs.map(program=>{const active=hasAccess(student.id, program.id); const busy=savingKey===`${student.id}:${program.id}`; return <td key={program.id} className="px-3 py-4 text-center"><button type="button" disabled={busy} onClick={()=>void toggleProgram(student,program)} className={`mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.03] text-slate-600 hover:text-slate-300"}`} aria-label={`${active ? "Remove" : "Grant"} ${program.title} access for ${student.full_name || student.email}`}>{busy?<Loader2 size={16} className="animate-spin"/>:active?<Check size={18}/>:<span className="text-lg">+</span>}</button></td>})}</tr>)}</tbody></table>{filteredStudents.length===0&&<div className="py-10 text-center text-sm text-slate-500">No student accounts match your search.</div>}</div></div>}
  </LearnShell>;
}
