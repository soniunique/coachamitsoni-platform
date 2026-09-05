import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";

export const Route = createFileRoute("/learn/assessments/$slug")({ component: AssessmentDetail });

function AssessmentDetail() {
  const { slug } = Route.useParams();
  return <LearnShell>
    <div className="mb-5"><Link to="/learn/assessments" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15}/>Back to Assessments</Link></div>
    <SectionHeader eyebrow="Assessment" title="Course Assessment" description="Review your latest result or start the next available attempt." />
    <div className="sr-only" aria-hidden="true">Assessment for {slug}</div>
  </LearnShell>;
}
