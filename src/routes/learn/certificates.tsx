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
    const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
    const popup = window.open("", "_blank", "width=1200,height=850");
    if (!popup) { setError("Please allow pop-ups to print your certificate."); setPrinting(null); return; }
    const issuedDate = new Date(certificate.issued_at).toLocaleDateString();
    const courseTitle = certificate.course?.title || "Course";
    const safeName = escapeXml(name), safeCourse = escapeXml(courseTitle), safeDate = escapeXml(issuedDate), safeNumber = escapeXml(certificate.certificate_number);
    popup.document.write(`<!doctype html><html><head><title>Certificate of Completion - ${safeCourse}</title><meta name="viewport" content="width=device-width, initial-scale=1"/><style>html,body{margin:0;padding:0;width:100%;min-height:100%}body{background:white;font-family:Georgia,"Times New Roman",serif}.page{width:100%;min-height:100vh;display:flex;align-items:center;justify-content:center}svg{display:block;width:100vw;height:auto;max-height:100vh}@media print{@page{size:landscape;margin:0}html,body,.page{width:100%;height:100%;min-height:100%}.page{display:block}svg{width:100vw;height:100vh;max-height:none}}</style></head><body><div class="page"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 690" role="img" aria-label="Certificate of Completion"><rect width="1120" height="690" fill="#fffdf8"/><rect x="10" y="10" width="1100" height="670" rx="5" fill="none" stroke="#062b4f" stroke-width="8"/><rect x="24" y="24" width="1072" height="642" rx="2" fill="none" stroke="#d9a83e" stroke-width="2"/><rect x="31" y="31" width="1058" height="628" rx="2" fill="none" stroke="#ead7a2" stroke-width="1"/><text x="560" y="74" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="4.5" fill="#078da6">CERTIFICATE OF COMPLETION</text><circle cx="560" cy="132" r="39" fill="#fffaf0" stroke="#d9a83e" stroke-width="3"/><circle cx="560" cy="132" r="31" fill="#0a5f86" stroke="#f0c75d" stroke-width="2"/><text x="560" y="141" text-anchor="middle" font-size="27" font-family="Arial, sans-serif" fill="#f6cf62">★</text><text x="560" y="224" text-anchor="middle" font-size="47" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#102b4e">Certificate of Completion</text><line x1="390" y1="241" x2="730" y2="241" stroke="#078da6" stroke-width="3"/><text x="560" y="281" text-anchor="middle" font-size="9" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.2" fill="#fffdf8">THIS CERTIFICATE IS PROUDLY PRESENTED TO</text><text x="560" y="339" text-anchor="middle" font-size="42" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-style="italic" fill="#18365a">${safeName}</text><text x="560" y="381" text-anchor="middle" font-size="15" fill="#64748b">for successfully completing</text><text x="560" y="422" text-anchor="middle" font-size="30" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#078da6">${safeCourse}</text><text x="425" y="488" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.5" fill="#102b4e">ISSUED</text><text x="425" y="507" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#596579">${safeDate}</text><text x="695" y="488" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.5" fill="#102b4e">CERTIFICATE NO.</text><text x="695" y="507" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#596579">${safeNumber}</text><text x="560" y="556" text-anchor="middle" font-size="25" font-family="'Brush Script MT', 'Segoe Script', cursive" font-style="italic" fill="#1d2939">Amit Soni</text></svg></div><script>window.onload=()=>{setTimeout(()=>window.print(),250)};</script></body></html>`);
    popup.document.close(); setPrinting(null);
  }

  return <LearnShell><SectionHeader eyebrow="MY LEARNING" title="Certificates" description="View and print certificates you have earned." /><div className="mx-auto max-w-5xl px-6 pb-12"><Link to="/learn" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16}/> Back to learning</Link>{loading?<div className="flex items-center gap-2 text-slate-300"><Loader2 className="animate-spin" size={18}/> Loading certificates…</div>:error?<div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5 text-rose-200">{error}</div>:certificates.length===0?<div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center"><Award className="mx-auto mb-3 text-slate-400" size={34}/><h2 className="text-lg font-semibold text-white">No certificates yet</h2><p className="mt-2 text-sm text-slate-400">Complete eligible courses to earn certificates.</p></div>:<div className="grid gap-5 md:grid-cols-2">{certificates.map(certificate=><div key={certificate.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Certificate</p><h2 className="mt-2 text-xl font-semibold text-white">{certificate.course?.title||"Course"}</h2><p className="mt-2 text-sm text-slate-400">Certificate No. {certificate.certificate_number}</p><p className="text-sm text-slate-400">Issued {new Date(certificate.issued_at).toLocaleDateString()}</p></div><Award className="text-cyan-300" size={28}/></div><button onClick={()=>void printCertificate(certificate)} disabled={printing===certificate.id} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-violet-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">{printing===certificate.id?<Loader2 className="animate-spin" size={16}/>:<Printer size={16}/>} Print certificate</button></div>)}</div>}</div></LearnShell>;
}
