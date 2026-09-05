import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/learn/assessments/$slug")({ component: AssessmentRedirect });

function AssessmentRedirect() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/learn/assessments", search: { course: slug }, replace: true });
  }, [navigate, slug]);
  return <div className="learn-card p-6 text-sm text-slate-400">Opening assessment…</div>;
}
