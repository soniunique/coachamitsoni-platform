import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, ClipboardCheck } from "lucide-react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { AssessmentSurface } from "@/components/learn/AssessmentSurface";

export const Route = createFileRoute("/learn/manage/assessment/$courseId")({ component: AssessmentManager });

function AssessmentManager() {
  const { courseId } = Route.useParams();
  return <LearnShell>
    <div className="mb-6">
      <Link to="/learn/manage/course-content/$courseId" params={{ courseId }} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15}/>Back to Course Content</Link>
    </div>
    <SectionHeader eyebrow="Admin · Assessment" title="Course Assessment" description="Manage assessment settings, certificate requirements, feedback, attempts and questions separately from course content." />
    <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-2">
      <Link to="/learn/manage/course-content/$courseId" params={{ courseId }} className="learn-secondary-button"><BookOpen size={16}/>Course Content</Link>
      <Link to="/learn/manage/assessment/$courseId" params={{ courseId }} className="learn-primary-button"><ClipboardCheck size={16}/>Assessment</Link>
    </div>
    <AssessmentSurface pathname={`/learn/manage/course-content/${courseId}`} isAdmin />
  </LearnShell>;
}
