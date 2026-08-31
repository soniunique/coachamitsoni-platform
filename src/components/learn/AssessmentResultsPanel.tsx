import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AttemptRow = {
  attempt_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  attempt_number: number;
  score: number;
  passed: boolean;
  submitted_at: string;
  answers: Record<string, string> | null;
};

type QuestionRow = {
  id: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correct_option: string;
  explanation: string | null;
};

export function AssessmentResultsPanel({ courseId }: { courseId: string }) {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AttemptRow | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    const { data: assessment, error: assessmentError } = await supabase
      .from("course_assessments")
      .select("id")
      .eq("course_id", courseId)
      .maybeSingle();
    if (assessmentError) {
      setError(assessmentError.message);
      setLoading(false);
      return;
    }
    if (!assessment) {
      setAssessmentId(null);
      setAttempts([]);
      setQuestions([]);
      setLoading(false);
      return;
    }
    setAssessmentId(assessment.id);
    const [{ data: resultData, error: resultError }, { data: questionData, error: questionError }] = await Promise.all([
      supabase.rpc("get_assessment_attempt_results", { p_assessment_id: assessment.id }),
      supabase.from("assessment_questions").select("id,prompt,options,correct_option,explanation").eq("assessment_id", assessment.id).order("sort_order"),
    ]);
    if (resultError || questionError) {
      setError((resultError || questionError)?.message || "Unable to load assessment results.");
      setLoading(false);
      return;
    }
    setAttempts((resultData || []) as AttemptRow[]);
    setQuestions((questionData || []) as QuestionRow[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [courseId]);

  const selectedAnswers = useMemo(() => selected?.answers || {}, [selected]);

  function optionText(question: QuestionRow, optionId: string | undefined) {
    if (!optionId) return "Not answered";
    return question.options.find((option) => option.id === optionId)?.text || optionId;
  }

  function exportCsv() {
    if (!attempts.length) return;
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Student", "Email", "Attempt", "Score", "Result", "Submitted At"],
      ...attempts.map((attempt) => [
        attempt.student_name,
        attempt.student_email,
        attempt.attempt_number,
        `${attempt.score}%`,
        attempt.passed ? "Passed" : "Failed",
        new Date(attempt.submitted_at).toLocaleString(),
      ]),
    ];
    const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `assessment-results-${courseId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!assessmentId) return null;

  return (
    <section className="learn-card mt-7 p-6" aria-labelledby="student-results-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="learn-eyebrow">Assessment administration</div>
          <h2 id="student-results-heading" className="mt-1 text-xl font-bold">Student Results</h2>
          <p className="mt-1 text-sm text-slate-400">Review submitted attempts, scores and pass/fail outcomes for this course assessment.</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={!attempts.length} className="learn-secondary-button">
          <Download size={15} />Export CSV
        </button>
      </div>

      {loading ? (
        <div className="mt-5 p-5 text-sm text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={16} />Loading student results...</div>
      ) : error ? (
        <div role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      ) : attempts.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-500">No submitted assessment attempts yet.</div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Student</th>
                <th className="px-3 py-3">Attempt</th>
                <th className="px-3 py-3">Score</th>
                <th className="px-3 py-3">Result</th>
                <th className="px-3 py-3">Submitted</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr key={attempt.attempt_id} className="border-b border-white/5">
                  <td className="px-3 py-3"><div className="font-medium">{attempt.student_name}</div><div className="text-xs text-slate-500">{attempt.student_email}</div></td>
                  <td className="px-3 py-3">#{attempt.attempt_number}</td>
                  <td className="px-3 py-3 font-semibold">{attempt.score}%</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${attempt.passed ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>
                      {attempt.passed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}{attempt.passed ? "Passed" : "Failed"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400">{new Date(attempt.submitted_at).toLocaleString()}</td>
                  <td className="px-3 py-3 text-right"><button type="button" onClick={() => setSelected(attempt)} className="learn-secondary-button">View result</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{selected.student_name} — Attempt #{selected.attempt_number}</h3>
              <p className="text-xs text-slate-500">{selected.student_email} · {new Date(selected.submitted_at).toLocaleString()}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="learn-secondary-button">Close</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 p-3"><div className="text-xs text-slate-500">Score</div><div className="mt-1 text-lg font-bold">{selected.score}%</div></div>
            <div className="rounded-xl border border-white/10 p-3"><div className="text-xs text-slate-500">Result</div><div className="mt-1 font-bold">{selected.passed ? "Passed" : "Failed"}</div></div>
            <div className="rounded-xl border border-white/10 p-3"><div className="text-xs text-slate-500">Submitted</div><div className="mt-1 text-sm">{new Date(selected.submitted_at).toLocaleString()}</div></div>
          </div>
          <div className="mt-5">
            <h4 className="text-sm font-semibold">Answer review</h4>
            {questions.length ? (
              <div className="mt-3 space-y-3">
                {questions.map((question, index) => {
                  const answerId = selectedAnswers[question.id];
                  const correct = answerId === question.correct_option;
                  return (
                    <div key={question.id} className="rounded-xl border border-white/10 p-4">
                      <div className="flex items-start justify-between gap-3"><div className="text-sm font-medium">{index + 1}. {question.prompt}</div><span className={`text-xs font-medium ${correct ? "text-emerald-300" : "text-amber-200"}`}>{correct ? "Correct" : "Incorrect"}</span></div>
                      <div className="mt-2 text-xs text-slate-400">Submitted answer: <span className="text-slate-200">{optionText(question, answerId)}</span></div>
                      <div className="mt-1 text-xs text-slate-400">Correct answer: <span className="text-slate-200">{optionText(question, question.correct_option)}</span></div>
                      {question.explanation && <div className="mt-2 text-xs leading-5 text-slate-400">Explanation: {question.explanation}</div>}
                    </div>
                  );
                })}
              </div>
            ) : <p className="mt-3 text-sm text-slate-500">Question details are unavailable for this assessment.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
