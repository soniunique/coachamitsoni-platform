import { createFileRoute } from "@tanstack/react-router";
import { Award, BookOpen, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Student = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};
type Program = { id: string; title: string };
type Enrollment = { user_id: string; program_id: string; status: string | null };
type Course = { id: string; title: string; program_id: string };
type Module = { id: string; course_id: string };
type Lesson = { id: string; module_id: string };
type Prog = { user_id: string; lesson_id: string; completed: boolean };
type Cert = { user_id: string; course_id: string; certificate_number: string; issued_at: string };
type StudentEmail = { id: string; email: string | null };

export const Route = createFileRoute("/learn/manage/students")({ component: Students });

function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentEmails, setStudentEmails] = useState<Record<string, string | null>>({});
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrolments, setEnrolments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Prog[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in.");
        setLoading(false);
        return;
      }

      const { data: me } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (me?.role !== "admin") {
        setError("Only admins can view students.");
        setLoading(false);
        return;
      }

      const [st, pr, en, co, mo, le, lp, ce] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,avatar_url,bio,created_at")
          .eq("role", "student")
          .order("full_name"),
        supabase.from("programs").select("id,title").order("sort_order"),
        supabase.from("program_enrollments").select("user_id,program_id,status"),
        supabase.from("courses").select("id,title,program_id"),
        supabase.from("course_modules").select("id,course_id"),
        supabase.from("course_lessons").select("id,module_id"),
        supabase.from("lesson_progress").select("user_id,lesson_id,completed"),
        supabase
          .from("course_certificates")
          .select("user_id,course_id,certificate_number,issued_at"),
      ]);

      const err = st.error || pr.error || en.error || co.error || mo.error || le.error || lp.error || ce.error;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const loadedStudents = (st.data || []) as Student[];
      setStudents(loadedStudents);
      setPrograms((pr.data || []) as Program[]);
      setEnrolments((en.data || []) as Enrollment[]);
      setCourses((co.data || []) as Course[]);
      setModules((mo.data || []) as Module[]);
      setLessons((le.data || []) as Lesson[]);
      setProgress((lp.data || []) as Prog[]);
      setCerts((ce.data || []) as Cert[]);
      setSelected(loadedStudents[0]?.id || "");

      const { data: emailData } = await supabase.functions.invoke("get-student-emails", {
        body: { user_ids: loadedStudents.map((student) => student.id) },
      });
      const emailRows = (emailData?.students || []) as StudentEmail[];
      setStudentEmails(
        Object.fromEntries(emailRows.map((student) => [student.id, student.email])),
      );

      setLoading(false);
    }

    void load();
  }, []);

  const filtered = useMemo(
    () => students.filter((s) => (s.full_name || "").toLowerCase().includes(query.toLowerCase())),
    [students, query],
  );
  const s = students.find((x) => x.id === selected);

  const details = useMemo(() => {
    if (!s) return null;
    const pes = enrolments.filter((e) => e.user_id === s.id && e.status !== "cancelled");
    const pids = new Set(pes.map((e) => e.program_id));
    const cs = courses.filter((c) => pids.has(c.program_id));
    const mids = new Set(
      modules.filter((m) => cs.some((c) => c.id === m.course_id)).map((m) => m.id),
    );
    const ls = lessons.filter((l) => mids.has(l.module_id));
    const done = new Set(
      progress.filter((p) => p.user_id === s.id && p.completed).map((p) => p.lesson_id),
    );

    const programStats = pes.map((e) => {
      const pcs = cs.filter((c) => c.program_id === e.program_id);
      const pmids = new Set(
        modules.filter((m) => pcs.some((c) => c.id === m.course_id)).map((m) => m.id),
      );
      const pls = lessons.filter((l) => pmids.has(l.module_id));
      const d = pls.filter((l) => done.has(l.id)).length;
      return {
        program: programs.find((p) => p.id === e.program_id)?.title || "Program",
        percent: pls.length ? Math.round((d / pls.length) * 100) : 0,
        courses: pcs.length,
        done: d,
        total: pls.length,
      };
    });

    return {
      programs: programStats,
      courses: cs,
      percent: ls.length ? Math.round((ls.filter((l) => done.has(l.id)).length / ls.length) * 100) : 0,
      certs: certs.filter((c) => c.user_id === s.id),
      lessons: ls.length,
      done: ls.filter((l) => done.has(l.id)).length,
    };
  }, [s, enrolments, courses, modules, lessons, progress, programs, certs]);

  if (loading) {
    return (
      <LearnShell>
        <div className="learn-card p-6 text-slate-400">
          <Loader2 className="mr-2 inline animate-spin" size={18} />
          Loading students...
        </div>
      </LearnShell>
    );
  }

  return (
    <LearnShell>
      <SectionHeader
        eyebrow="Admin · Students"
        title="Students"
        description="View enrolments, progress and certificates for your students."
      />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="learn-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-500" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none"
            />
          </div>
          <div className="mt-3 space-y-1">
            {filtered.map((x) => (
              <button
                key={x.id}
                onClick={() => setSelected(x.id)}
                className={`w-full rounded-xl px-3 py-3 text-left ${
                  selected === x.id
                    ? "bg-cyan-400/10 ring-1 ring-cyan-400/30"
                    : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 overflow-hidden rounded-full bg-white/10">
                    {x.avatar_url ? (
                      <img src={x.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-semibold">
                        {(x.full_name || "S").slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{x.full_name || "Student"}</div>
                    <div className="truncate text-xs text-slate-500">
                      {studentEmails[x.id] || "Email unavailable"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {enrolments.filter((e) => e.user_id === x.id && e.status !== "cancelled").length} programs
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {!filtered.length && <p className="p-3 text-sm text-slate-500">No students found.</p>}
          </div>
        </aside>

        <main>
          {error ? (
            <div className="learn-card p-6 text-sm text-red-300">{error}</div>
          ) : !s || !details ? (
            <div className="learn-card p-8 text-center text-sm text-slate-500">Select a student.</div>
          ) : (
            <div className="space-y-5">
              <div className="learn-card p-6">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-white/10">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xl font-semibold">
                        {(s.full_name || "S").slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold">{s.full_name || "Student"}</h2>
                    <p className="mt-1 truncate text-sm text-cyan-300">
                      {studentEmails[s.id] || "Email unavailable"}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Student since {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <Stat label="Overall progress" value={`${details.percent}%`} />
                  <Stat label="Lessons" value={`${details.done}/${details.lessons}`} />
                  <Stat label="Certificates" value={`${details.certs.length}`} />
                </div>
              </div>

              <div className="learn-card p-6">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-cyan-300" />
                  <h3 className="text-lg font-bold">Programs</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {details.programs.map((p, i) => (
                    <div
                      key={`${p.program}-${i}`}
                      className="rounded-xl border border-white/8 bg-white/[.03] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{p.program}</span>
                        <span className="text-sm font-semibold text-cyan-300">{p.percent}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                          style={{ width: `${p.percent}%` }}
                        />
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {p.courses} courses · {p.done} of {p.total} lessons complete
                      </div>
                    </div>
                  ))}
                  {!details.programs.length && (
                    <p className="text-sm text-slate-500">No active program enrolments.</p>
                  )}
                </div>
              </div>

              <div className="learn-card p-6">
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-cyan-300" />
                  <h3 className="text-lg font-bold">Certificates</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {details.certs.map((c) => (
                    <div
                      key={c.certificate_number}
                      className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[.03] p-4"
                    >
                      <div>
                        <div className="font-semibold">
                          {courses.find((x) => x.id === c.course_id)?.title || "Course"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {c.certificate_number} · {new Date(c.issued_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Award size={18} className="text-cyan-300" />
                    </div>
                  ))}
                  {!details.certs.length && (
                    <p className="text-sm text-slate-500">No certificates yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </LearnShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[.03] p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
