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
import { toast } from "sonner";
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
    const lastText = new WeakMap<Element, string>();
    const successPattern = /(saved|submitted|updated|created|deleted|sent|enrolled|registered|published|completed|successfully)/i;
    const actionPattern = /^(save|submit|create|update|delete|send|enroll|register|publish|mark\s+complete)/i;
    const pending = new WeakMap<HTMLButtonElement, number>();

    const showSuccessToast = (element: Element) => {
      const text = element.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!text || !successPattern.test(text)) return;
      if (lastText.get(element) === text) return;
      lastText.set(element, text);
      toast.success(text, { duration: 4000 });
    };

    const hasExplicitSuccess = () => {
      return Array.from(
        document.querySelectorAll('[role="status"], [aria-live="polite"], [data-action-feedback="success"], .text-emerald-300'),
      ).some((element) => successPattern.test(element.textContent?.replace(/\s+/g, " ").trim() || ""));
    };

    const hasVisibleError = () => {
      return Boolean(
        document.querySelector('[role="alert"], [aria-live="assertive"], .text-red-300, .text-red-400'),
      );
    };

    const genericMessage = (label: string) => {
      const normalized = label.toLowerCase();
      if (normalized.startsWith("save")) return "Saved successfully.";
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

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(target instanceof HTMLButtonElement)) return;
      const label = target.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!actionPattern.test(label)) return;

      const token = window.setTimeout(() => {
        pending.delete(target);
        if (hasVisibleError() || hasExplicitSuccess()) return;
        if (document.body.contains(target) && (target.disabled || /saving|submitting|creating|updating|deleting|sending/i.test(target.textContent || ""))) {
          pending.set(target, window.setTimeout(() => {
            pending.delete(target);
            if (!hasVisibleError() && !hasExplicitSuccess() && !target.disabled) {
              toast.success(genericMessage(label), { duration: 3500 });
            }
          }, 1800));
          return;
        }
        toast.success(genericMessage(label), { duration: 3500 });
      }, 1800);
      pending.set(target, token);
    };

    const scan = () => {
      document
        .querySelectorAll('[role="status"], [aria-live="polite"], [data-action-feedback="success"]')
        .forEach(showSuccessToast);
    };

    document.addEventListener("click", onClick, true);
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    return () => {
      document.removeEventListener("click", onClick, true);
      observer.disconnect();
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
