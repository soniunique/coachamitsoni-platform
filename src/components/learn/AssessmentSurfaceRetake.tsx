import { AssessmentSurface } from "@/components/learn/AssessmentSurface";

/**
 * Retake wrapper kept as a stable integration point for LearnShell.
 * Retake eligibility and behavior are handled inside AssessmentSurface so
 * React remains the single owner of the rendered button and its state.
 */
export function AssessmentSurfaceRetake({ pathname, isAdmin }: { pathname: string; isAdmin: boolean }) {
  return <AssessmentSurface pathname={pathname} isAdmin={isAdmin} />;
}
