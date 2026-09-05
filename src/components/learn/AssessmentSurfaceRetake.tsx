import { useEffect } from "react";
import { AssessmentSurface } from "@/components/learn/AssessmentSurface";

export function AssessmentSurfaceRetake({ pathname, isAdmin }: { pathname: string; isAdmin: boolean }) {
  if (!isAdmin && pathname.startsWith("/learn/courses/") && pathname !== "/learn/courses") return null;
  if (!isAdmin && pathname.startsWith("/learn/assessments")) return null;
  return <AssessmentSurface pathname={pathname} isAdmin={isAdmin} />;
}
