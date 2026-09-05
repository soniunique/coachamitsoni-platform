import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ClipboardCheck, CircleAlert, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Course = { id: string; slug: string; title: string; description: string | null; program_id: string };
type Assessment = { id: string; title: string; passing_percentage: number; max_attempts: number | null };
type StudentPayload = { enabled: boolean; assessment?: Assessment; completion?: { lessons_total: number; lessons_completed: number; percentage: number; can_start: boolean }; latest_attempt?: { score: number; passed: boolean; attempt_number: number } | null };
type Card = Course & { payload: StudentPayload | null };

export const Route = createFileRoute("/learn/assessments")({ component: Assessments });

function Assessments() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      if (!programIds.length) { setCards([]); setLoading(false); return; }
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id,slug,title,description,program_id")
        .eq("status", "published")
        .eq("assessment_enabled", true)
        .in("program_id", programIds)
        .order("created_at", { ascending: false });
      if (courseError) { setError(courseError.message); setLoading(false); return; }
      const loaded = (courseData ?? []) as Course[];
      const results = await Promise.all(loaded.map(async course => {
        const { data, error: payloadError } = await supabase.rpc("get_student_assessment", { p_course_id: course.id });
        return { course, payload: payloadError ? null : data as StudentPayload | null };
      }));
      setCards(results.filter(item => item.payload?.enabled && item.payload.assessment).map(item => ({ ...item.course, payload: item.payload })));
      setLoading(false);
    }
    void load();
  }, []);

  return <LearnShell>
    <SectionHeader eyebrow="Assessment center" title="Assessments" description="Complete, review and retake assessments for your enrolled courses." />
    {loading ? <div className="learn-card flex items-center gap-3 p-6 text-sm text-slate-400"><Loader2 size={18} className="animate-spin" />Loading assessments...</div> : error ? <div className="learn-card p-6 text-sm text-red-300">{error}</div> : cards.length === 0 ? <div className="learn-card p-10 text-center"><ClipboardCheck className="mx-auto text-cyan-300" size={34}/><h2 className="mt-4 text-lg font-bold">No assessments available</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Assessments appear here when an enrolled published course has an enabled assessment.</p></div> : <div className="grid gap-4 lg:grid-cols-2">
      {cards.map(({ id, slug, title, payload }) => {
        const assessment = payload!.assessment!;
        const latest = payload!.latest_attempt;
        const completion = payload!.completion;
        const maxAttempts = assessment.max_attempts;
        const attemptsUsed = latest?.attempt_number ?? 0;
        const attemptsRemaining = maxAttempts == null ? null : Math.max(0, maxAttempts - attemptsUsed);
        const locked = assessment && completion?.can_start === false && assessment.require_completion !== false;
        return <article key={id} className="learn-card p-5">
          <div className="flex items-start gap-3"><div className="learn-icon-tile shrink-0"><ClipboardCheck size={18}/></div><div className="min-w-0 flex-1"><div className="learn-eyebrow">Course assessment</div><h2 className="mt-1 truncate text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-slate-400">{assessment.title}</p></div>{latest?.passed ? <CheckCircle2 className="shrink-0 text-emerald-400" size={20}/> : latest ? <CircleAlert className="shrink-0 text-amber-300" size={20}/> : null}</div>
          {locked ? <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Complete all course lessons first. Progress: {completion?.lessons_completed ?? 0} / {completion?.lessons_total ?? 0} lessons.</div> : latest ? <div className={`mt-4 rounded-xl border p-3 text-sm ${latest.passed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>{latest.passed ? `Passed — ${latest.score}%` : `Not passed — ${latest.score}%`} · Attempt {latest.attempt_number}{maxAttempts != null ? ` of ${maxAttempts}` : ""}</div> : <div className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3 text-sm text-slate-300">Not attempted yet.</div>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-slate-500">Passing score {assessment.passing_percentage}% · {attemptsRemaining == null ? "Unlimited attempts" : `${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining`}</div><Link to="/learn/assessments/$slug" params={{ slug }} className="learn-primary-button">{latest?.passed ? "View / Retake" : latest ? "Try again" : "Start assessment"}<ArrowRight size={14}/></Link></div>
        </article>;
      })}
    </div>}
  </LearnShell>;
}
