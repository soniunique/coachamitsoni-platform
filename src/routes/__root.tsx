import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "../components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function GlobalActionFeedback() {
  useEffect(() => {
    const pending = new WeakMap<HTMLButtonElement, number>();
    const notified = new WeakSet<HTMLButtonElement>();
    const actionPattern = /^(save|submit|create|update|delete|send|enroll|register|publish|mark\s+complete)/i;
    const workingPattern = /(saving|submitting|creating|updating|deleting|sending|enrolling|registering|publishing)/i;

    const genericMessage = (label: string) => {
      const normalized = label.toLowerCase();
      if (normalized.startsWith("save")) return "Changes saved successfully.";
      if (normalized.startsWith("submit")) return "Submitted successfully.";
      if (normalized.startsWith("create")) return "Created successfully.";
      if (normalized.startsWith("update")) return "Updated successfully.";
      if (normalized.startsWith("delete")) return "Deleted successfully.";
      if (normalized.startsWith("send")) return "Sent successfully.";
      if (normalized.startsWith("enroll")) return "Enrolment updated successfully.";
      if (normalized.startsWith("register")) return "Registered successfully.";
      if (normalized.startsWith("publish")) return "Published successfully.";
      return "Action completed successfully.";
    };

    const hasVisibleError = () => Boolean(
      document.querySelector('[role="alert"], [aria-live="assertive"], .text-red-300, .text-red-400'),
    );

    const hasSpecificSuccess = () => Boolean(
      document.querySelector('[role="status"][data-action-feedback="success"], [data-action-feedback="success"]'),
    );

    const showInlineToast = (message: string) => {
      const existing = document.querySelector('[data-global-action-toast="true"]');
      existing?.remove();

      const node = document.createElement("div");
      node.setAttribute("data-global-action-toast", "true");
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      node.textContent = `✓ ${message}`;
      Object.assign(node.style, {
        position: "fixed",
        left: "50%",
        bottom: "28px",
        transform: "translateX(-50%)",
        zIndex: "2147483647",
        padding: "12px 18px",
        borderRadius: "12px",
        border: "1px solid rgba(52, 211, 153, 0.45)",
        background: "rgba(6, 32, 27, 0.96)",
        color: "#a7f3d0",
        boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        fontSize: "14px",
        fontWeight: "600",
        pointerEvents: "none",
      });
      document.body.appendChild(node);
      window.setTimeout(() => node.remove(), 3500);
    };

    const clearPending = (button: HTMLButtonElement) => {
      const timer = pending.get(button);
      if (timer) window.clearTimeout(timer);
      pending.delete(button);
    };

    const watchAction = (button: HTMLButtonElement, label: string) => {
      const startedAt = Date.now();
      const check = () => {
        if (notified.has(button) || hasVisibleError() || hasSpecificSuccess()) {
          clearPending(button);
          return;
        }

        if (!document.body.contains(button)) {
          clearPending(button);
          return;
        }

        const current = button.textContent?.replace(/\s+/g, " ").trim() || "";
        const working = button.disabled || workingPattern.test(current);
        const timedLongEnough = Date.now() - startedAt >= 1200;

        if (!working && timedLongEnough) {
          notified.add(button);
          showInlineToast(genericMessage(label));
          clearPending(button);
          return;
        }

        if (Date.now() - startedAt >= 12000) {
          clearPending(button);
          return;
        }

        pending.set(button, window.setTimeout(check, 250));
      };

      pending.set(button, window.setTimeout(check, 1200));
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(target instanceof HTMLButtonElement)) return;
      const label = target.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!actionPattern.test(label)) return;
      clearPending(target);
      notified.delete(target);
      watchAction(target, label);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.querySelector('[data-global-action-toast="true"]')?.remove();
    };
  }, []);

  return null;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Amit Soni — AI Agents Educator | Cloud Architecture" },
      {
        name: "description",
        content:
          "AI education, practical AI agents and professional career/product experience for working professionals.",
      },
      { name: "author", content: "Amit Soni" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Toaster position="bottom-center" richColors duration={4000} />
        <GlobalActionFeedback />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
