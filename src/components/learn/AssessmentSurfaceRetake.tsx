import { useEffect } from "react";
import { AssessmentSurface } from "@/components/learn/AssessmentSurface";

/**
 * Keeps the existing assessment surface intact while enabling a passed learner
 * to start the next attempt. The server remains authoritative for the attempt
 * limit; this wrapper only fixes the client-side disabled-state behavior in the
 * current assessment surface.
 */
export function AssessmentSurfaceRetake({ pathname, isAdmin }: { pathname: string; isAdmin: boolean }) {
  useEffect(() => {
    if (isAdmin || !pathname.startsWith("/learn/courses/") || pathname === "/learn/courses") return;

    const bridgeRetakeButton = () => {
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
        return label === "Start assessment" || label === "Starting..." || label === "Retake Assessment" || label === "Maximum attempts reached";
      }) as HTMLButtonElement | undefined;
      if (!startButton) return;

      const currentLabel = (startButton.textContent || "").replace(/\s+/g, " ").trim();
      if (currentLabel === "Starting...") return;

      const nextLabel = canRetake ? "Retake Assessment" : "Maximum attempts reached";
      if (currentLabel !== nextLabel) startButton.textContent = nextLabel;

      startButton.disabled = !canRetake;
      startButton.setAttribute("aria-label", nextLabel);
      if (canRetake) startButton.classList.remove("opacity-50", "cursor-not-allowed");

      if (!canRetake || startButton.dataset.retakeBridge === "true") return;
      startButton.dataset.retakeBridge = "true";

      startButton.addEventListener("pointerdown", (event) => {
        if (!canRetake) return;

        const reactPropsKey = Object.keys(startButton).find((key) => key.startsWith("__reactProps$"));
        const reactProps = reactPropsKey ? (startButton as unknown as Record<string, { onClick?: (e: unknown) => void }>)[reactPropsKey] : undefined;
        if (!reactProps?.onClick) return;

        event.preventDefault();
        event.stopPropagation();
        reactProps.onClick(event);
      }, true);
    };

    bridgeRetakeButton();
    const observer = new MutationObserver(bridgeRetakeButton);
    observer.observe(document.querySelector("main.learn-content") || document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
    const interval = window.setInterval(bridgeRetakeButton, 500);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [pathname, isAdmin]);

  return <AssessmentSurface pathname={pathname} isAdmin={isAdmin} />;
}
