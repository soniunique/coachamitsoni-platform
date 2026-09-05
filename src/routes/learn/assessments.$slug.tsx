import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AssessmentSurface } from "@/components/learn/AssessmentSurface";
import { LearnShell } from "@/components/learn/LearnShell";

export const Route = createFileRoute("/learn/assessments/$slug")({ component: AssessmentDetail });

function AssessmentDetail() {
  const { slug } = Route.useParams();
  return <LearnShell>
    <div className="mb-5"><Link to="/learn/assessments" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15}/>Back to Assessments</Link></div>
    <AssessmentSurface pathname={`/learn/courses/${slug}`} isAdmin={false} />
  </LearnShell>;
}
