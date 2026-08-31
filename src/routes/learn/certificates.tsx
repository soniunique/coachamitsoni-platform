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

    const escapeXml = (value: string) => value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&apos;");

    const popup = window.open("", "_blank", "width=1200,height=850");
    if (!popup) { setError("Please allow pop-ups to print your certificate."); setPrinting(null); return; }

    const issuedDate = new Date(certificate.issued_at).toLocaleDateString();
    const courseTitle = certificate.course?.title || "Course";
    const safeName = escapeXml(name);
    const safeCourse = escapeXml(courseTitle);
    const safeDate = escapeXml(issuedDate);
    const safeNumber = escapeXml(certificate.certificate_number);

    popup.document.write(`<!doctype html>
<html>
<head>
  <title>Certificate of Completion - ${safeCourse}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }
    body { background: white; font-family: Georgia, "Times New Roman", serif; }
    .page { width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    svg { display: block; width: 100vw; height: auto; max-height: 100vh; }
    @media print {
      @page { size: landscape; margin: 0; }
      html, body, .page { width: 100%; height: 100%; min-height: 100%; }
      .page { display: block; }
      svg { width: 100vw; height: 100vh; max-height: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 690" role="img" aria-label="Certificate of Completion">
      <rect x="0" y="0" width="1120" height="690" fill="#fffdf8"/>
      <rect x="8" y="8" width="1104" height="674" rx="2" fill="none" stroke="#102b4e" stroke-width="8"/>
      <rect x="22" y="22" width="1076" height="646" fill="none" stroke="#d8a83e" stroke-width="2"/>

      <path d="M0 0H330L255 90H0Z" fill="#092b4c"/>
      <path d="M0 0H405L315 108H0Z" fill="#0d9bb5" opacity="0.88"/>
      <path d="M0 0H465L365 122H0Z" fill="#e1b14a" opacity="0.9"/>
      <path d="M1120 690H790L865 600H1120Z" fill="#092b4c"/>
      <path d="M1120 690H715L805 582H1120Z" fill="#0d9bb5" opacity="0.88"/>
      <path d="M1120 690H655L755 568H1120Z" fill="#e1b14a" opacity="0.9"/>

      <text x="560" y="74" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="4.2" fill="#0a8fa8">CERTIFICATE OF COMPLETION</text>
      <circle cx="560" cy="132" r="35" fill="#fffaf0" stroke="#d8a83e" stroke-width="2"/>
      <circle cx="560" cy="132" r="29" fill="none" stroke="#d8a83e" stroke-width="1" opacity="0.55"/>
      <text x="560" y="142" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#0a8fa8">★</text>

      <text x="560" y="208" text-anchor="middle" font-size="47" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#102b4e">Certificate of Completion</text>
      <rect x="395" y="224" width="330" height="3" fill="#d8a83e"/>
      <rect x="475" y="224" width="170" height="3" fill="#0a8fa8"/>

      <text x="560" y="264" text-anchor="middle" font-size="16" fill="#64748b">This certificate is proudly presented to</text>
      <text x="560" y="320" text-anchor="middle" font-size="42" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-style="italic" fill="#162f52">${safeName}</text>
      <text x="560" y="357" text-anchor="middle" font-size="15" fill="#64748b">for successfully completing</text>
      <text x="560" y="401" text-anchor="middle" font-size="30" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#078ba5">${safeCourse}</text>

      <line x1="360" y1="456" x2="535" y2="456" stroke="#e4c36f" stroke-width="1"/>
      <line x1="585" y1="456" x2="760" y2="456" stroke="#e4c36f" stroke-width="1"/>
      <text x="447" y="477" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.2" fill="#102b4e">ISSUED</text>
      <text x="447" y="499" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#596579">${safeDate}</text>
      <text x="673" y="477" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.2" fill="#102b4e">CERTIFICATE NO.</text>
      <text x="673" y="499" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#596579">${safeNumber}</text>

      <text x="560" y="544" text-anchor="middle" font-size="25" font-family="'Brush Script MT', 'Segoe Script', cursive" fill="#1d2939">Amit Soni</text>
      <line x1="475" y1="552" x2="645" y2="552" stroke="#d8a83e" stroke-width="1"/>
      <text x="560" y="571" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1" fill="#0a8fa8">COACH AMIT SONI</text>
      <text x="560" y="590" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" fill="#64748b">AI Learning Hub</text>
    </svg>
  </div>
</body>
</html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => { popup.print(); setPrinting(null); }, 500);
  }

  return <LearnShell><div className="mb-4"><Link to="/learn" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} />Learning hub</Link></div><SectionHeader eyebrow="Achievements" title="My certificates" description="Certificates are available only for courses you are enrolled in and have completed to at least 80%." />{loading ? <div className="learn-card flex items-center gap-3 p-6 text-sm text-slate-400"><Loader2 size={18} className="animate-spin" />Checking certificate eligibility...</div> : error ? <div className="learn-card p-6 text-sm text-red-300">{error}</div> : !certificates.length ? <div className="learn-card p-8 text-center"><Award className="mx-auto text-cyan-300" size={36} /><h2 className="mt-4 text-lg font-bold">No certificates yet</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">Certificates appear here once you are enrolled in the course and have completed at least 80% of it.</p><Link to="/learn/courses" className="learn-primary-button mt-5 inline-flex"><BookOpen size={15} />Browse courses</Link></div> : <div className="grid gap-5 lg:grid-cols-2">{certificates.map((certificate) => <article key={certificate.id} className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 shadow-lg shadow-cyan-950/20" id={`certificate-${certificate.id}`}><div className="pointer-events-none absolute -left-16 -top-12 h-32 w-72 -rotate-12 rounded-full bg-gradient-to-r from-blue-950 via-cyan-600 to-amber-400 opacity-80" /><div className="pointer-events-none absolute -bottom-16 -right-16 h-32 w-72 -rotate-12 rounded-full bg-gradient-to-r from-amber-400 via-cyan-600 to-blue-950 opacity-80" /><div className="relative p-7 text-center"><div className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">Certificate of Completion</div><div className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/60 bg-amber-300/10 shadow-[0_0_25px_rgba(251,191,36,.12)]"><Star className="text-amber-300" size={29} fill="currentColor" /></div><h2 className="mt-4 text-2xl font-bold text-white">{name}</h2><p className="mt-2 text-sm text-slate-400">has successfully completed</p><div className="mt-2 text-xl font-bold text-cyan-200">{certificate.course?.title || "Course"}</div><div className="mx-auto mt-4 h-px w-48 bg-gradient-to-r from-transparent via-amber-300 to-transparent" /><div className="mt-4 text-xs text-slate-400">Issued {new Date(certificate.issued_at).toLocaleDateString()} · {certificate.certificate_number}</div></div><div className="relative flex items-center justify-between border-t border-white/10 bg-slate-950/35 px-5 py-4"><Link to="/learn/courses/$slug" params={{ slug: certificate.course?.slug || "" }} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">View course</Link><button type="button" onClick={() => void printCertificate(certificate)} disabled={printing !== null} className="learn-secondary-button border-cyan-300/20 bg-cyan-300/5 disabled:cursor-not-allowed disabled:opacity-50"><Printer size={15} />{printing === certificate.id ? "Preparing…" : "Print certificate"}</button></div></article>)}</div>}</LearnShell>;
}
