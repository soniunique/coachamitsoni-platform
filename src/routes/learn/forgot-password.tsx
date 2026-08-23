import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/amit-logo.png";

export const Route = createFileRoute("/learn/forgot-password")({
  ssr: false,
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSent(false);

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/learn/reset-password`,
        });

      if (resetError) throw resetError;

      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send the password reset link.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="learn-auth-shell">
      <div className="learn-auth-orb learn-auth-orb-a" />
      <div className="learn-auth-orb learn-auth-orb-b" />

      <div className="learn-auth-card">
        <Link to="/" className="mb-8 flex justify-center">
          <img
            src={logo}
            alt="Amit Soni"
            className="h-16 w-auto"
          />
        </Link>

        <div className="text-center">
          <div className="learn-eyebrow">Coach Amit Soni</div>
          <h1 className="mt-2 text-3xl font-bold">
            Forgot password
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Enter your email and we&apos;ll send you a secure link to set a
            new password.
          </p>
        </div>

        {sent ? (
          <div className="mt-7">
            <div className="learn-alert success">
              If an account exists for this email, a password reset link is
              on its way. Please check your inbox.
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-sm font-medium">
              Email
              <div className="relative mt-2">
                <Mail
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  className="learn-input pl-10"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
            </label>

            {error && <div className="learn-alert error">{error}</div>}

            <button
              className="learn-primary-button w-full"
              disabled={busy}
            >
              {busy ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <ShieldCheck size={17} />
              )}
              {busy ? "Sending link…" : "Send reset link"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <Link
            to="/learn/login"
            className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"
          >
            <ArrowLeft size={15} />
            Back to sign in
          </Link>
        </div>

        <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck size={14} />
          Secure account recovery powered by Supabase
        </div>
      </div>
    </div>
  );
}