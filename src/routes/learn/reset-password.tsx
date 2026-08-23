import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/amit-logo.png";

export const Route = createFileRoute("/learn/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const passwordPolicy =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!passwordPolicy.test(password)) {
      setError(
        "Use at least 8 characters with uppercase, lowercase, a number, and a symbol.",
      );
      return;
    }

    setBusy(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      await navigate({
        to: "/learn",
        replace: true,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update your password.",
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
            Set a new password
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Choose a new password for your student account.
          </p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium">
            New password
            <div className="relative mt-2">
              <input
                className="learn-input pr-11"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
                title="Use at least 8 characters with uppercase, lowercase, a number, and a symbol."
                placeholder="8+ chars, upper/lowercase, number & symbol"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </div>
          </label>

          <label className="block text-sm font-medium">
            Confirm new password
            <div className="relative mt-2">
              <input
                className="learn-input pr-11"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Enter the password again"
              />
              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword((value) => !value)
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                aria-label={
                  showConfirmPassword
                    ? "Hide confirmation password"
                    : "Show confirmation password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
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
            {busy ? "Updating password…" : "Update password"}
          </button>
        </form>

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
          Secure account access powered by Supabase
        </div>
      </div>
    </div>
  );
}