import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, ArrowLeft, BookOpen, Loader2, Printer, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Certificate = { id: string; certificate_number: string; issued_at: string; course_id: string; course: { title: string; slug: string } | null };
type Eligibility = { enrolled: boolean; progress: number };

export const Route = createFileRoute("/learn/certificates")({ component: Certificates });

function Certificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [eligibility, setEligibility] = useState<Record<string, Eligibility>>({});
  const [name, setName] = useState("Learner");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError("");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Please sign in to view your certificates."); setLoading(false); return; }
      const [{ data: rows, error: ce }, { data: profile }, { data: enrolments, error: ee }] = await Promise.all([
        supabase.from("course_certificates").select("id,certificate_number,issued_at,course_id,courses(title,slug)").order("issued_at", { ascending: false }),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("program_enrollments").select("program_id,status").eq("user_id", user.id).in("status", ["active", "completed"]),
      ]);
      if (ce) { setError(ce.message); setLoading(false); return; }
      if (ee) { setError(ee.message); setLoading(false); return; }
      if (profile?.full_name) setName(profile.full_name);
      const certs = ((rows || []) as unknown as Certificate[]);
      const programIds = (enrolments || []).map((e) => e.program_id);
      const courseIds = certs.map((c) => c.course_id);
      const nextEligibility: Record<string, Eligibility> = {};
      const courseDetails: Record<string, { title: string; slug: string }> = {};
      if (courseIds.length) {
        const { data: courseRows, error: courseError } = await supabase.from("courses").select("id,title,slug,program_id,course_modules(course_lessons(id,lesson_progress(user_id,completed)))").in("id", courseIds);
        if (courseError) { setError(courseError.message); setLoading(false); return; }
        for (const course of (courseRows || []) as any[]) {
          courseDetails[course.id] = { title: course.title, slug: course.slug };
          const enrolled = programIds.includes(course.program_id);
          const lessons = (course.course_modules || []).flatMap((m: any) => m.course_lessons || []);
          const completed = lessons.filter((lesson: any) => (lesson.lesson_progress || []).some((p: any) => p.user_id === user.id && p.completed === true)).length;
          const progress = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
          nextEligibility[course.id] = { enrolled, progress };
        }
      }
      setEligibility(nextEligibility);
      setCertificates(certs.filter((c) => nextEligibility[c.course_id]?.enrolled && nextEligibility[c.course_id]?.progress >= 80).map((c) => ({ ...c, course: courseDetails[c.course_id] || c.course })));
      setLoading(false);
    }
    void load();
  }, []);

  async function printCertificate(certificate: Certificate) {
    if (printing) return;
    const current = eligibility[certificate.course_id];
    if (!current?.enrolled || current.progress < 80) { setError("This certificate is available for printing only when you are enrolled in the course and have completed at least 80% of it."); return; }
    setPrinting(certificate.id);
    const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) { setError("Please allow pop-ups to print your certificate."); setPrinting(null); return; }
    const issuedDate = new Date(certificate.issued_at).toLocaleDateString();
    const courseTitle = certificate.course?.title || "Course";
    popup.document.write(`<!doctype html><html><head><title>Certificate of Completion - ${escapeHtml(courseTitle)}</title><meta name="viewport" content="width=device-width, initial-scale=1" /><style>
* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
html, body { margin: 0; min-height: 100%; }
body { font-family: Georgia, "Times New Roman", serif; background: #dfe7f1; color: #13233f; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
.page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 28px; }
.certificate { position: relative; overflow: hidden; width: 100%; max-width: 1120px; min-height: 690px; padding: 58px 78px; background: #fffdf8; border: 8px solid #102b4e; outline: 2px solid #d8a83e; outline-offset: -20px; text-align: center; box-shadow: 0 20px 60px rgba(15,23,42,.22); -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
.certificate::before, .certificate::after { content: ""; position: absolute; width: 390px; height: 150px; pointer-events: none; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
.certificate::before { top: -34px; left: -95px; transform: rotate(-18deg); background: linear-gradient(135deg, #092b4c 0 43%, #0d9bb5 44% 62%, #e1b14a 63% 72%, transparent 73%); }
.certificate::after { right: -95px; bottom: -34px; transform: rotate(-18deg); background: linear-gradient(135deg, transparent 0 27%, #e1b14a 28% 37%, #0d9bb5 38% 56%, #092b4c 57%); }
.eyebrow { position: relative; z-index: 1; margin-top: 5px; font-size: 13px; font-weight: 700; letter-spacing: .32em; text-transform: uppercase; color: #0a8fa8; }
.seal { position: relative; z-index: 1; width: 70px; height: 70px; margin: 25px auto 18px; border: 2px solid #d8a83e; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #0a8fa8; background: #fffaf0; box-shadow: 0 0 0 7px rgba(216,168,62,.10); }
h1 { position: relative; z-index: 1; margin: 0; font-size: 48px; line-height: 1.1; color: #102b4e; }
.gold-rule { position: relative; z-index: 1; width: 330px; height: 3px; margin: 12px auto 18px; background: linear-gradient(90deg, transparent, #d8a83e, #0a8fa8, #d8a83e, transparent); }
.subtitle { position: relative; z-index: 1; margin: 0 0 8px; font-size: 16px; color: #64748b; }
.name { position: relative; z-index: 1; margin: 4px 0 12px; font-size: 42px; font-weight: 700; font-style: italic; color: #162f52; }
.course-label { position: relative; z-index: 1; margin-top: 6px; font-size: 15px; color: #64748b; }
.course { position: relative; z-index: 1; margin-top: 6px; font-size: 30px; font-weight: 700; color: #078ba5; }
.meta { position: relative; z-index: 1; margin: 42px auto 0; display: flex; justify-content: center; gap: 70px; font-family: Arial, sans-serif; font-size: 12px; color: #596579; }
.meta div { min-width: 155px; padding: 8px 20px; border-top: 1px solid #e4c36f; }
.meta strong { display: block; margin-bottom: 4px; color: #102b4e; font-size: 11px; text-transform: uppercase; letter-spacing: .10em; }
.signature { position: relative; z-index: 1; margin-top: 26px; font-family: Arial, sans-serif; }
.signature-name { font-family: "Brush Script MT", "Segoe Script", cursive; font-size: 25px; color: #1d2939; }
.signature-line { width: 170px; height: 1px; margin: 3px auto 5px; background: #d8a83e; }
.signature-role { font-size: 11px; font-weight: 700; letter-spacing: .08em; color: #0a8fa8; }
.signature-org { margin-top: 2px; font-size: 10px; color: #64748b; }
@media print { @page { size: landscape; margin: 0; } body { background: #fff; } .page { min-height: 100vh; padding: 0; } .certificate { max-width: none; width: 100vw; min-height: 100vh; border-width: 8px; outline-offset: -18px; box-shadow: none; } }
</style></head><body><div class="page"><main class="certificate"><div class="eyebrow">Certificate of Completion</div><div class="seal">★</div><h1>Certificate of Completion</h1><div class="gold-rule"></div><div class="subtitle">This certificate is proudly presented to</div><div class="name">${escapeHtml(name)}</div><div class="course-label">for successfully completing</div><div class="course">${escapeHtml(courseTitle)}</div><div class="meta"><div><strong>Issued</strong>${escapeHtml(issuedDate)}</div><div><strong>Certificate No.</strong>${escapeHtml(certificate.certificate_number)}</div></div><div class="signature"><div class="signature-name">Amit Soni</div><div class="signature-line"></div><div class="signature-role">COACH AMIT SONI</div><div class="signature-org">AI Learning Hub</div></div></main></div></body></html>`);
    popup.document.close(); popup.focus(); window.setTimeout(() => { popup.print(); setPrinting(null); }, 350);
  }

  return <LearnShell><div className="mb-4"><Link to="/learn" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} />Learning hub</Link></div><SectionHeader eyebrow="Achievements" title="My certificates" description="Certificates are available only for courses you are enrolled in and have completed to at least 80%." />{loading ? <div className="learn-card flex items-center gap-3 p-6 text-sm text-slate-400"><Loader2 size={18} className="animate-spin" />Checking certificate eligibility...</div> : error ? <div className="learn-card p-6 text-sm text-red-300">{error}</div> : !certificates.length ? <div className="learn-card p-8 text-center"><Award className="mx-auto text-cyan-300" size={36} /><h2 className="mt-4 text-lg font-bold">No certificates yet</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">Certificates appear here once you are enrolled in the course and have completed at least 80% of it.</p><Link to="/learn/courses" className="learn-primary-button mt-5 inline-flex"><BookOpen size={15} />Browse courses</Link></div> : <div className="grid gap-5 lg:grid-cols-2">{certificates.map((certificate) => <article key={certificate.id} className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 shadow-lg shadow-cyan-950/20" id={`certificate-${certificate.id}`}><div className="pointer-events-none absolute -left-16 -top-12 h-32 w-72 -rotate-12 rounded-full bg-gradient-to-r from-blue-950 via-cyan-600 to-amber-400 opacity-80" /><div className="pointer-events-none absolute -bottom-16 -right-16 h-32 w-72 -rotate-12 rounded-full bg-gradient-to-r from-amber-400 via-cyan-600 to-blue-950 opacity-80" /><div className="relative p-7 text-center"><div className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">Certificate of Completion</div><div className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/60 bg-amber-300/10 shadow-[0_0_25px_rgba(251,191,36,.12)]"><Star className="text-amber-300" size={29} fill="currentColor" /></div><h2 className="mt-4 text-2xl font-bold text-white">{name}</h2><p className="mt-2 text-sm text-slate-400">has successfully completed</p><div className="mt-2 text-xl font-bold text-cyan-200">{certificate.course?.title || "Course"}</div><div className="mx-auto mt-4 h-px w-48 bg-gradient-to-r from-transparent via-amber-300 to-transparent" /><div className="mt-4 text-xs text-slate-400">Issued {new Date(certificate.issued_at).toLocaleDateString()} · {certificate.certificate_number}</div></div><div className="relative flex items-center justify-between border-t border-white/10 bg-slate-950/35 px-5 py-4"><Link to="/learn/courses/$slug" params={{ slug: certificate.course?.slug || "" }} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">View course</Link><button type="button" onClick={() => void printCertificate(certificate)} disabled={printing !== null} className="learn-secondary-button border-cyan-300/20 bg-cyan-300/5 disabled:cursor-not-allowed disabled:opacity-50"><Printer size={15} />{printing === certificate.id ? "Preparing…" : "Print certificate"}</button></div></article>)}</div>}</LearnShell>;
}
