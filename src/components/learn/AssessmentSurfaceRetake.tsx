import { useEffect } from "react";
import { AssessmentSurface } from "@/components/learn/AssessmentSurface";

/**
 * Keeps the already-tested assessment surface intact while enabling the
 * requested retake UX for passed learners. The server remains authoritative
 * for the actual attempt limit.
 */
export function AssessmentSurfaceRetake({ pathname, isAdmin }: { pathname: string; isAdmin: boolean }) {
  useEffect(() => {
    if (isAdmin || !pathname.startsWith("/learn/courses/") || pathname === "/learn/courses") return;

    const refreshRetakeButton = () => {
      const root = document.querySelector("main.learn-content");
      if (!root) return;

      const text = root.textContent || "";
      const passedMatch = text.match(/Latest attempt:\s*[^—]+—\s*Passed\s*\(attempt\s*(\d+)\)/i);
      const maxMatch = text.match(/Attempts:\s*(\d+)\s+maximum/i);
      if (!passedMatch) return;

      const attemptNumber = Number(passedMatch[1]);
      const maxAttempts = maxMatch ? Number(maxMatch[1]) : null;
      const canRetake = maxAttempts === null || attemptNumber < maxAttempts;

      const buttons = Array.from(root.querySelectorAll("button"));
      const startButton = buttons.find((button) => {
        const label = (button.textContent || "").replace(/\s+/g, " ").trim();
        return label === "Start assessment" || label === "Starting..." || label === "Retake Assessment";
      });
      if (!startButton) return;

      if (canRetake) {
        startButton.textContent = "Retake Assessment";
        startButton.removeAttribute("disabled");
        startButton.setAttribute("aria-label", "Retake Assessment");
        startButton.classList.remove("opacity-50", "cursor-not-allowed");
      } else {
        startButton.textContent = "Maximum attempts reached";
        startButton.setAttribute("disabled", "true");
        startButton.setAttribute("aria-label", "Maximum attempts reached");
      }
    };

    refreshRetakeButton();
    const observer = new MutationObserver(refreshRetakeButton);
    observer.observe(document.querySelector("main.learn-content") || document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });
    const interval = window.setInterval(refreshRetakeButton, 500);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [pathname, isAdmin]);

  return <AssessmentSurface pathname={pathname} isAdmin={isAdmin} />;
}
