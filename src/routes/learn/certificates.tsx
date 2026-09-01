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
  <defs>
    <linearGradient id="navyTeal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#062b4f"/><stop offset="0.52" stop-color="#0a5f86"/><stop offset="1" stop-color="#0ba4b7"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b88420"/><stop offset="0.5" stop-color="#e7bd55"/><stop offset="1" stop-color="#f4d47b"/></linearGradient>
    <linearGradient id="teal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#087a9c"/><stop offset="1" stop-color="#12b5bd"/></linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-opacity="0.18"/></filter>
  </defs>

  <rect width="1120" height="690" fill="#fffdf8"/>
  <rect x="10" y="10" width="1100" height="670" rx="5" fill="none" stroke="#062b4f" stroke-width="8"/>
  <rect x="24" y="24" width="1072" height="642" rx="2" fill="none" stroke="#d9a83e" stroke-width="2"/>
  <rect x="31" y="31" width="1058" height="628" rx="2" fill="none" stroke="#ead7a2" stroke-width="1"/>

  <path d="M0 0H300C245 62 184 82 92 77C58 75 29 87 0 111Z" fill="url(#navyTeal)"/>
  <path d="M0 0H265C210 53 157 67 83 63C50 61 25 69 0 87Z" fill="#0b91a8" opacity=".9"/>
  <path d="M0 0H210C174 39 131 50 78 48C45 47 21 54 0 67Z" fill="url(#gold)"/>
  <path d="M1120 690H820C875 628 936 608 1028 614C1060 616 1090 605 1120 579Z" fill="url(#navyTeal)"/>
  <path d="M1120 690H855C910 637 963 624 1037 628C1070 630 1094 621 1120 604Z" fill="#0b91a8" opacity=".9"/>
  <path d="M1120 690H910C946 651 989 642 1042 644C1075 645 1099 637 1120 624Z" fill="url(#gold)"/>

  <g fill="none" stroke="#0b91a8" stroke-width="1" opacity=".09">
    <path d="M40 515C180 455 250 560 370 505S560 460 650 520"/>
    <path d="M35 530C175 470 250 575 370 520S560 475 650 535"/>
    <path d="M470 120C610 60 700 165 820 110S1000 75 1080 125"/>
    <path d="M465 132C605 72 695 177 815 122S995 87 1080 137"/>
  </g>

  <text x="560" y="74" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="4.5" fill="#078da6">CERTIFICATE OF COMPLETION</text>

  <g transform="translate(560 132)" filter="url(#softShadow)">
    <g fill="none" stroke="#d9a83e" stroke-width="3" stroke-linecap="round">
      <path d="M-43 26C-64 5-64-19-45-38"/>
      <path d="M43 26C64 5 64-19 45-38"/>
    </g>
    <g fill="#d9a83e" opacity=".95">
      <ellipse cx="-52" cy="16" rx="6" ry="3" transform="rotate(32 -52 16)"/><ellipse cx="-59" cy="3" rx="6" ry="3" transform="rotate(12 -59 3)"/><ellipse cx="-60" cy="-11" rx="6" ry="3" transform="rotate(-10 -60 -11)"/><ellipse cx="-55" cy="-24" rx="6" ry="3" transform="rotate(-30 -55 -24)"/>
      <ellipse cx="52" cy="16" rx="6" ry="3" transform="rotate(-32 52 16)"/><ellipse cx="59" cy="3" rx="6" ry="3" transform="rotate(-12 59 3)"/><ellipse cx="60" cy="-11" rx="6" ry="3" transform="rotate(10 60 -11)"/><ellipse cx="55" cy="-24" rx="6" ry="3" transform="rotate(30 55 -24)"/>
    </g>
    <circle r="39" fill="#fffaf0" stroke="url(#gold)" stroke-width="3"/>
    <circle r="31" fill="url(#navyTeal)" stroke="#f0c75d" stroke-width="2"/>
    <text x="0" y="9" text-anchor="middle" font-size="27" font-family="Arial, sans-serif" fill="#f6cf62">★</text>
  </g>

  <text x="560" y="224" text-anchor="middle" font-size="47" font-family="Georgia, 'Times New Roman', serif" font-weight="700" letter-spacing=".5" fill="#102b4e">Certificate of Completion</text>
  <line x1="390" y1="241" x2="485" y2="241" stroke="#d9a83e" stroke-width="2"/>
  <line x1="485" y1="241" x2="635" y2="241" stroke="#078da6" stroke-width="3"/>
  <line x1="635" y1="241" x2="730" y2="241" stroke="#d9a83e" stroke-width="2"/>

  <path d="M405 269H715L697 286H423Z" fill="url(#teal)"/>
  <path d="M405 269L420 277L405 286L423 286L440 277L423 269Z" fill="#075f7b"/>
  <path d="M715 269L700 277L715 286H697L680 277L697 269Z" fill="#075f7b"/>
  <text x="560" y="281" text-anchor="middle" font-size="9" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.2" fill="#fffdf8">THIS CERTIFICATE IS PROUDLY PRESENTED TO</text>

  <text x="560" y="339" text-anchor="middle" font-size="42" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-style="italic" fill="#18365a">${safeName}</text>
  <line x1="430" y1="350" x2="500" y2="350" stroke="#d9a83e" stroke-width="1.5"/>
  <line x1="620" y1="350" x2="690" y2="350" stroke="#d9a83e" stroke-width="1.5"/>

  <text x="560" y="381" text-anchor="middle" font-size="15" fill="#64748b">for successfully completing</text>
  <text x="560" y="422" text-anchor="middle" font-size="30" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#078da6">${safeCourse}</text>

  <line x1="350" y1="466" x2="500" y2="466" stroke="#d9a83e" stroke-width="1"/>
  <line x1="620" y1="466" x2="770" y2="466" stroke="#d9a83e" stroke-width="1"/>
  <text x="425" y="488" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.5" fill="#102b4e">ISSUED</text>
  <text x="425" y="507" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#596579">${safeDate}</text>
  <text x="695" y="488" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.5" fill="#102b4e">CERTIFICATE NO.</text>
  <text x="695" y="507" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#596579">${safeNumber}</text>

  <text x="560" y="556" text-anchor="middle" font-size="25" font-family="'Brush Script MT', 'Segoe Script', cursive" font-style="italic" fill="#1d2939">Amit Soni</text>
  <line x1="480" y1="563" x2="640" y2="563" stroke="#d9a83e" stroke-width="1"/>
  <text x="560" y="582" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1" fill="#078da6">COACH AMIT SONI</text>
  <text x="560" y="599" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" fill="#64748b">AI Learning Hub</text>

  <g transform="translate(948 585) rotate(-8)" filter="url(#softShadow)">
    <circle r="42" fill="#0a4165" stroke="#e0b449" stroke-width="4"/>
    <circle r="33" fill="none" stroke="#f0ca65" stroke-width="1.5"/>
    <text x="0" y="-7" text-anchor="middle" font-size="18" font-family="Arial, sans-serif" fill="#f4ce65">★</text>
    <text x="0" y="10" text-anchor="middle" font-size="7" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1" fill="#fffdf8">AI LEARNING HUB</text>
    <path d="M-23 36L-15 58L0 46L15 58L23 36Z" fill="#d9a83e"/>
  </g>
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
