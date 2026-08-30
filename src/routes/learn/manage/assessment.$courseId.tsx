import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { AssessmentSurface } from "@/components/learn/AssessmentSurface";

export const Route = createFileRoute("/learn/manage/assessment/$courseId")({ component: AssessmentManager });

function AssessmentManager() {
  const { courseId } = Route.useParams();
  return <LearnShell>
    <div className="mb-6">
      <Link to="/learn/manage/courses/$courseId" params={{ courseId }} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15}/>Back to Course</Link>
    </div>
    <SectionHeader eyebrow="Admin · Assessment" title="Course Assessment" description="Configure the assessment, certificate requirement and multiple-choice questions for this course." />
    <AssessmentSurface pathname={`/learn/manage/course-content/${courseId}`} isAdmin />
  </LearnShell>;
}
