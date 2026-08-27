import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, UserCheck } from "lucide-react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";

export const Route = createFileRoute("/learn/manage/course-students/$courseId")({ component: CourseStudentsRedirect });

function CourseStudentsRedirect() {
  return <LearnShell>
    <SectionHeader eyebrow="Admin" title="Program access is now the access model" description="Student access is no longer granted course-by-course. Assign the student to a program instead; that automatically unlocks all published courses and lessons in the program." />
    <div className="learn-card p-6"><div className="learn-icon-tile"><UserCheck size={20}/></div><h2 className="mt-4 text-xl font-bold">Manage access by program</h2><p className="mt-2 text-sm leading-6 text-slate-400">This old course-level enrolment screen has been retired so the platform has one consistent access rule.</p><div className="mt-5 flex gap-3"><Link to="/learn/manage/enrolments" className="learn-primary-button"><UserCheck size={15}/>Open Program Access</Link><Link to="/learn/manage/courses" className="learn-secondary-button"><ArrowLeft size={15}/>Programs & Courses</Link></div></div>
  </LearnShell>;
}
