import { useEffect } from "react";
import { AssessmentSurface } from "@/components/learn/AssessmentSurface";

/**
 * Keeps the shared assessment engine intact while exposing it only where the
 * existing application expects a globally mounted surface. Student assessments
 * use the dedicated Assessments destination instead of rendering inside the
 * course player or as a nested detail page.
 */
export function AssessmentSurfaceRetake({ pathname, isAdmin }: { pathname: string; isAdmin: boolean }) {
  if (!isAdmin && pathname.startsWith("/learn/courses/") && pathname !== "/learn/courses") return null;
  if (!isAdmin && pathname.startsWith("/learn/assessments")) return null;
  return <AssessmentSurface pathname={pathname} isAdmin={isAdmin} />;
}
