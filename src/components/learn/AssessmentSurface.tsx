import { CheckCircle2, CircleAlert, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Option = { id: string; text: string };
type Question = { id?: string; prompt: string; options: Option[]; correct_option: string; points: number; sort_order: number };
type Assessment = { id: string; course_id: string; title: string; instructions: string | null; passing_percentage: number; max_attempts: number | null };
type StudentPayload = { enabled: boolean; assessment?: Assessment; questions?: Question[] };

const blankQuestion = (): Question => ({ prompt: "", options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }, { id: "d", text: "" }], correct_option: "a", points: 1, sort_order: 0 });

export function AssessmentSurface({ pathname, isAdmin }: { pathname: string; isAdmin: boolean }) {
  if (pathname.startsWith("/learn/manage/course-content/")) {
    const courseId = pathname.split("/").filter(Boolean).pop() || "";
    return courseId ? <AdminAssessment courseId={courseId} /> : null;
  }
  if (pathname.startsWith("/learn/courses/") && pathname !== "/learn/courses") {
    const slug = pathname.split("/").filter(Boolean).pop() || "";
    return slug ? <StudentAssessment slug={slug} isAdmin={isAdmin} /> : null;
  }
  return null;
}

function AdminAssessment({ courseId }: { courseId: string }) {
  const [courseTitle, setCourseTitle] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [required, setRequired] = useState(false);
  const [title, setTitle] = useState("Course Assessment");
  const [instructions, setInstructions] = useState("");
  const [passing, setPassing] = useState(80);
  const [maxAttempts, setMaxAttempts] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const [{ data: course, error: ce }, { data: a, error: ae }] = await Promise.all([
      supabase.from("courses").select("title,assessment_enabled,assessment_required").eq("id", courseId).maybeSingle(),
      supabase.from("course_assessments").select("id,course_id,title,instructions,passing_percentage,max_attempts").eq("course_id", courseId).maybeSingle(),
    ]);
    if (ce || ae) { setError((ce || ae)?.message || "Unable to load assessment."); setLoading(false); return; }
    setCourseTitle(course?.title || "Course"); setEnabled(Boolean(course?.assessment_enabled)); setRequired(Boolean(course?.assessment_required));
    if (a) {
      setAssessment(a as Assessment); setTitle(a.title); setInstructions(a.instructions || ""); setPassing(Number(a.passing_percentage)); setMaxAttempts(a.max_attempts || 0);
      const { data: qs, error: qe } = await supabase.from("assessment_questions").select("id,prompt,options,correct_option,points,sort_order").eq("assessment_id", a.id).order("sort_order");
      if (qe) setError(qe.message); else setQuestions((qs || []) as Question[]);
    } else { setAssessment(null); setQuestions([]); setTitle("Course Assessment"); setInstructions(""); setPassing(80); setMaxAttempts(0); }
    setLoading(false);
  }
  useEffect(() => { void load(); }, [courseId]);

  async function save() {
    setSaving(true); setError(""); setMessage("");
    if (!title.trim()) { setError("Assessment title is required."); setSaving(false); return; }
    if (passing < 1 || passing > 100) { setError("Passing percentage must be between 1 and 100."); setSaving(false); return; }
    if (required && !enabled) { setError("A required assessment must be enabled."); setSaving(false); return; }
    for (const [i, q] of questions.entries()) {
      const filledOptions = q.options.filter(o => o.text.trim());
      if (!q.prompt.trim()) { setError(`Question ${i + 1}: Please enter the question text.`); setSaving(false); return; }
      if (filledOptions.length < 2) { setError(`Question ${i + 1}: Please enter at least two answer options.`); setSaving(false); return; }
      if (!filledOptions.some(o => o.id === q.correct_option)) { setError(`Question ${i + 1}: Please select a correct answer from the completed options.`); setSaving(false); return; }
    }
    const values = { course_id: courseId, title: title.trim(), instructions: instructions.trim() || null, passing_percentage: passing, max_attempts: maxAttempts > 0 ? maxAttempts : null };
    const { data: saved, error: ae } = assessment
      ? await supabase.from("course_assessments").update(values).eq("id", assessment.id).select("id,course_id,title,instructions,passing_percentage,max_attempts").single()
      : await supabase.from("course_assessments").insert(values).select("id,course_id,title,instructions,passing_percentage,max_attempts").single();
    if (ae || !saved) { setError(ae?.message || "Unable to save assessment."); setSaving(false); return; }
    const { error: ce } = await supabase.from("courses").update({ assessment_enabled: enabled, assessment_required: required }).eq("id", courseId);
    if (ce) { setError(ce.message); setSaving(false); return; }
    const { error: de } = await supabase.from("assessment_questions").delete().eq("assessment_id", saved.id);
    if (de) { setError(de.message); setSaving(false); return; }
    if (questions.length) {
      const rows = questions.map((q, i) => ({ assessment_id: saved.id, prompt: q.prompt.trim(), options: q.options.filter(o => o.text.trim()).map(o => ({ id: o.id, text: o.text.trim() })), correct_option: q.correct_option, points: Math.max(1, Number(q.points) || 1), sort_order: i }));
      const { error: qe } = await supabase.from("assessment_questions").insert(rows);
      if (qe) { setError(qe.message); setSaving(false); return; }
    }
    setMessage("Assessment saved successfully."); setAssessment(saved as Assessment); await load(); setSaving(false);
  }

  const updateQuestion = (index: number, patch: Partial<Question>) => setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...patch } : q));
  const updateOption = (qi: number, oi: number, text: string) => setQuestions(prev => prev.map((q, i) => {
    if (i !== qi) return q;
    const options = q.options.map((o, j) => j === oi ? { ...o, text } : o);
    const correct_option = q.correct_option === q.options[oi]?.id && !text.trim() ? (options.find(o => o.text.trim())?.id || "") : q.correct_option;
    return { ...q, options, correct_option };
  }));
  const addQuestion = () => setQuestions(prev => [...prev, { ...blankQuestion(), sort_order: prev.length }]);

  if (loading) return <div className="learn-card mt-6 p-6 text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={17}/>Loading assessment settings...</div>;
  return <section className="learn-card mt-6 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="learn-eyebrow">Assessment</div><h2 className="mt-1 text-xl font-bold">{courseTitle} — Course Assessment</h2><p className="mt-1 text-sm text-slate-400">Optional by default. When marked required, students must pass it before certificate eligibility is granted.</p></div>
      <button type="button" onClick={() => void save()} disabled={saving} className="learn-primary-button">{saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} {saving ? "Saving..." : "Save assessment"}</button>
    </div>
    {error && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
    {message && <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</div>}
    <div className="mt-6 grid gap-5 md:grid-cols-2">
      <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/><span><strong>Enable assessment</strong><span className="block text-xs text-slate-500">Students can attempt the assessment.</span></span></label>
      <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)}/><span><strong>Required for certificate</strong><span className="block text-xs text-slate-500">Passing the assessment becomes an additional certificate requirement.</span></span></label>
    </div>
    <div className="mt-5 grid gap-5 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium">Assessment title</label><input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"/></div><div><label className="mb-2 block text-sm font-medium">Passing percentage</label><input type="number" min="1" max="100" value={passing} onChange={e => setPassing(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"/></div></div>
    <div className="mt-5 grid gap-5 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium">Instructions</label><textarea rows={4} value={instructions} onChange={e => setInstructions(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" placeholder="Complete all questions and submit your answers."/></div><div><label className="mb-2 block text-sm font-medium">Maximum attempts</label><input type="number" min="0" value={maxAttempts} onChange={e => setMaxAttempts(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"/><p className="mt-2 text-xs text-slate-500">0 means unlimited attempts.</p></div></div>
    <div className="mt-7 border-t border-white/10 pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Questions</h3><p className="text-xs text-slate-500">Multiple-choice questions are graded automatically. Enter at least two options; up to four may be used.</p></div><button type="button" onClick={addQuestion} className="learn-secondary-button"><Plus size={15}/>Add question</button></div>
      <div className="mt-4 space-y-4">{questions.map((q, qi) => <div key={q.id || `new-${qi}`} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-[.15em] text-slate-500">Question {qi + 1}</div><div className="mt-1 text-xs text-slate-500">Choose the radio button to mark the correct answer.</div></div><button type="button" onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))} className="learn-icon-button text-red-300" aria-label="Delete question"><Trash2 size={16}/></button></div><label className="mt-3 block text-sm font-medium">Question text</label><textarea rows={3} value={q.prompt} onChange={e => updateQuestion(qi, { prompt: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" placeholder="Enter the question..."/><div className="mt-4 grid gap-3 md:grid-cols-2">{q.options.map((o, oi) => <div key={o.id} className="flex items-center gap-3"><input type="radio" name={`correct-${qi}`} checked={q.correct_option === o.id} disabled={!o.text.trim()} onChange={() => updateQuestion(qi, { correct_option: o.id })}/><div className="min-w-0 flex-1"><label className="mb-1 block text-xs font-medium text-slate-400">Option {o.id.toUpperCase()}{q.correct_option === o.id ? " · Correct answer" : ""}</label><input value={o.text} onChange={e => updateOption(qi, oi, e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white" placeholder="Enter answer option..."/></div></div>)}</div><div className="mt-4 w-32"><label className="mb-2 block text-xs text-slate-500">Points</label><input type="number" min="1" value={q.points} onChange={e => updateQuestion(qi, { points: Number(e.target.value) })} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"/></div></div>)}</div>
      <div className="mt-5 flex justify-center border-t border-white/10 pt-5"><button type="button" onClick={addQuestion} className="learn-secondary-button"><Plus size={15}/>Add another question</button></div>
    </div>
  </section>;
}

function StudentAssessment({ slug, isAdmin }: { slug: string; isAdmin: boolean }) {
  const [courseId, setCourseId] = useState("");
  const [payload, setPayload] = useState<StudentPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [latest, setLatest] = useState<{ score: number; passed: boolean; attempt_number: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ score: number; passed: boolean; attempt_number: number; passing_percentage: number } | null>(null);

  async function load() {
    setLoading(true); setError("");
    const { data: course, error: ce } = await supabase.from("courses").select("id").eq("slug", slug).eq("status", "published").maybeSingle();
    if (ce || !course) { setLoading(false); return; }
    setCourseId(course.id);
    const { data, error: re } = await supabase.rpc("get_student_assessment", { p_course_id: course.id });
    if (re) { if (!isAdmin) setError(re.message); setLoading(false); return; }
    const p = data as StudentPayload; setPayload(p);
    if (p.enabled && p.assessment) {
      const { data: attempts } = await supabase.from("assessment_attempts").select("score,passed,attempt_number").eq("assessment_id", p.assessment.id).order("submitted_at", { ascending: false }).limit(1);
      setLatest((attempts?.[0] as any) || null);
    }
    setLoading(false);
  }
  useEffect(() => { void load(); }, [slug]);

  const questionCount = payload?.questions?.length || 0;
  const answered = useMemo(() => Object.keys(answers).length, [answers]);
  if (loading || !payload?.enabled || !payload.assessment || !questionCount) return null;

  async function submit() {
    if (answered !== questionCount) { setError(`Please answer all ${questionCount} questions before submitting.`); return; }
    setSubmitting(true); setError(""); setResult(null);
    const { data, error: se } = await supabase.rpc("submit_course_assessment", { p_assessment_id: payload.assessment.id, p_answers: answers });
    if (se) { setError(se.message); setSubmitting(false); return; }
    const r = data as { score: number; passed: boolean; attempt_number: number; passing_percentage: number };
    setResult(r); setLatest(r); setAnswers({}); setSubmitting(false);
  }

  return <section className="learn-card mt-8 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="learn-eyebrow">Course Assessment</div><h2 className="mt-1 text-2xl font-bold">{payload.assessment.title}</h2>{payload.assessment.instructions && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{payload.assessment.instructions}</p>}</div><div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><div className="text-xs text-slate-500">Passing score</div><div className="font-bold text-cyan-300">{payload.assessment.passing_percentage}%</div></div></div>
    {latest && !result && <div className={`mt-5 rounded-xl border p-4 text-sm ${latest.passed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>{latest.passed ? <CheckCircle2 className="mr-2 inline" size={17}/> : <CircleAlert className="mr-2 inline" size={17}/>}Last attempt: <strong>{latest.score}%</strong> — {latest.passed ? "Passed" : "Not passed"} (attempt {latest.attempt_number}).</div>}
    {error && <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {result && <div className={`mt-5 rounded-xl border p-5 ${result.passed ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}><div className="text-lg font-bold">{result.passed ? "Assessment passed" : "Assessment not passed"}</div><p className="mt-1 text-sm text-slate-300">You scored <strong>{result.score}%</strong>. Passing score is {result.passing_percentage}%.</p>{!result.passed && <button type="button" onClick={() => setResult(null)} className="learn-secondary-button mt-4">Try again</button>}</div>}
    {!result && <><div className="mt-6 space-y-5">{(payload.questions || []).map((q, i) => <div key={q.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><div className="text-sm font-semibold">{i + 1}. {q.prompt}</div><div className="mt-4 grid gap-2">{q.options.map(o => <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${answers[q.id || ""] === o.id ? "border-cyan-400/60 bg-cyan-400/10 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"}`}><input type="radio" name={`question-${q.id}`} checked={answers[q.id || ""] === o.id} onChange={() => setAnswers(prev => ({ ...prev, [q.id || ""]: o.id }))}/><span>{o.text}</span></label>)}</div></div>)}</div><div className="mt-6 flex items-center justify-between gap-4"><span className="text-xs text-slate-500">{answered} of {questionCount} answered</span><button type="button" onClick={() => void submit()} disabled={submitting} className="learn-primary-button">{submitting ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} {submitting ? "Submitting..." : "Submit assessment"}</button></div></>}
  </section>;
}
