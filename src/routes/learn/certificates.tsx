import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, ArrowLeft, BookOpen, Loader2, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Certificate = {
  id: string;
  certificate_number: string;
  issued_at: string;
  course_id: string;
  course: { title: string; slug: string } | null;
};

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
      setLoading(true);
      setError("");
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
        const { data: courseRows, error: courseError } = await supabase
          .from("courses")
          .select("id,title,slug,program_id,course_modules(course_lessons(id,lesson_progress(user_id,completed)))")
          .in("id", courseIds);
        if (courseError) { setError(courseError.message); setLoading(false); return; }

        for (const course of (courseRows || []) as any[]) {
          courseDetails[course.id] = { title: course.title, slug: course.slug };
          const enrolled = programIds.includes(course.program_id);
          const lessons = (course.course_modules || []).flatMap((m: any) => m.course_lessons || []);
          const completed = lessons.filter((lesson: any) =>
            (lesson.lesson_progress || []).some((p: any) => p.user_id === user.id && p.completed === true)
          ).length;
          const progress = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
          nextEligibility[course.id] = { enrolled, progress };
        }
      }

      setEligibility(nextEligibility);
      // Use the separately fetched course records for display as well as eligibility.
      // This avoids relying on a nested relationship response that may be null under RLS.
      const eligibleCerts = certs
        .filter((c) => nextEligibility[c.course_id]?.enrolled && nextEligibility[c.course_id]?.progress >= 80)
        .map((c) => ({ ...c, course: courseDetails[c.course_id] || c.course }));
      setCertificates(eligibleCerts);
      setLoading(false);
    }
    void load();
  }, []);

  async function printCertificate(certificate: Certificate) {
    if (printing) return;
    const current = eligibility[certificate.course_id];
    if (!current?.enrolled || current.progress < 80) {
      setError("This certificate is available for printing only when you are enrolled in the course and have completed at least 80% of it.");
      return;
    }
    setPrinting(certificate.id);
    const node = document.getElementById(`certificate-${certificate.id}`);
    if (!node) { setPrinting(null); return; }
    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) { setError("Please allow pop-ups to print your certificate."); setPrinting(null); return; }
    popup.document.write(`<!doctype html><html><head><title>Certificate of Completion</title><style>body{margin:0;font-family:Georgia,serif;background:#07111f;color:#fff}.page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px;box-sizing:border-box}.certificate{width:100%;max-width:960px;box-sizing:border-box;border:2px solid #67e8f9;padding:70px;text-align:center;background:linear-gradient(145deg,#0b1830,#111c35)}h1{font-size:48px;margin:10px 0 20px}.name{font-size:38px;font-weight:700;margin:25px 0}.course{font-size:28px;font-weight:700;margin:15px 0}.meta{margin-top:40px;font-size:14px;color:#b6c3d9;display:flex;justify-content:space-between}.seal{font-size:54px;color:#67e8f9}@media print{body{background:#fff;color:#111}.page{padding:0}.certificate{max-width:none;min-height:90vh;background:#fff;border-color:#111}.meta{color:#444}}</style></head><body><div class="page">${node.innerHTML}</div></body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => { popup.print(); setPrinting(null); }, 250);
  }

  return <LearnShell>
    <div className="mb-4"><Link to="/learn" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} />Learning hub</Link></div>
    <SectionHeader eyebrow="Achievements" title="My certificates" description="Certificates are available only for courses you are enrolled in and have completed to at least 80%." />
    {loading ? <div className="learn-card flex items-center gap-3 p-6 text-sm text-slate-400"><Loader2 size={18} className="animate-spin" />Checking certificate eligibility...</div> : error ? <div className="learn-card p-6 text-sm text-red-300">{error}</div> : !certificates.length ? <div className="learn-card p-8 text-center"><Award className="mx-auto text-cyan-300" size={36} /><h2 className="mt-4 text-lg font-bold">No certificates yet</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">Certificates appear here once you are enrolled in the course and have completed at least 80% of it.</p><Link to="/learn/courses" className="learn-primary-button mt-5 inline-flex"><BookOpen size={15} />Browse courses</Link></div> : <div className="grid gap-5 lg:grid-cols-2">{certificates.map((certificate) => <article key={certificate.id} className="learn-card overflow-hidden p-0" id={`certificate-${certificate.id}`}><div className="p-7 text-center"><div className="text-xs font-semibold uppercase tracking-[.22em] text-cyan-300">Certificate of Completion</div><div className="mt-5 flex justify-center"><div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10"><Award className="text-cyan-300" size={30} /></div></div><h2 className="mt-5 text-2xl font-bold">{name}</h2><p className="mt-3 text-sm text-slate-400">has successfully completed</p><div className="mt-3 text-xl font-bold text-white">{certificate.course?.title || "Course"}</div><div className="mt-6 text-xs text-slate-500">Issued {new Date(certificate.issued_at).toLocaleDateString()} · {certificate.certificate_number}</div></div><div className="flex items-center justify-between border-t border-white/8 px-5 py-4"><Link to="/learn/courses/$slug" params={{ slug: certificate.course?.slug || "" }} className="text-xs text-cyan-300 hover:text-cyan-200">View course</Link><button type="button" onClick={() => void printCertificate(certificate)} disabled={printing !== null} className="learn-secondary-button disabled:cursor-not-allowed disabled:opacity-50"><Printer size={15} />{printing === certificate.id ? "Preparing…" : "Print certificate"}</button></div></article>)}</div>}
  </LearnShell>;
}
