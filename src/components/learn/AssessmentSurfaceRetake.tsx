import { AssessmentSurface } from "@/components/learn/AssessmentSurface";

/**
 * Keep assessment rendering separate from the course player for students.
 * The dedicated assessment route reuses the existing assessment implementation
 * without changing its session, attempt, scoring, or certificate behavior.
 */
export function AssessmentSurfaceRetake({ pathname, isAdmin }: { pathname: string; isAdmin: boolean }) {
  if (!isAdmin && pathname.startsWith("/learn/courses/") && pathname !== "/learn/courses") return null;
  if (!isAdmin && pathname.startsWith("/learn/assessments/") && pathname !== "/learn/assessments") {
    const slug = pathname.split("/").filter(Boolean).pop() || "";
    return slug ? <AssessmentSurface pathname={`/learn/courses/${slug}`} isAdmin={false} /> : null;
  }
  return <AssessmentSurface pathname={pathname} isAdmin={isAdmin} />;
}
