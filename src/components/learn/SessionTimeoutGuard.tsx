import { useEffect, useRef, useState } from "react";
import { Clock3, LogOut, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";

const IDLE_WARNING_MS = 15 * 60 * 1000;
const WARNING_GRACE_MS = 5 * 60 * 1000;
const ACTIVITY_KEY_PREFIX = "coachamitsoni:learn:last-activity:";
const ACTIVITY_WRITE_THROTTLE_MS = 1500;

function activityKey(userId: string) {
  return `${ACTIVITY_KEY_PREFIX}${userId}`;
}

function readActivity(userId: string) {
  const value = localStorage.getItem(activityKey(userId));
  const timestamp = value ? Number(value) : NaN;
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function SessionTimeoutGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(300);
  const [signingOut, setSigningOut] = useState(false);
  const lastPersistedRef = useRef(0);
  const lastActivityRef = useRef<number | null>(null);
  const warningDeadlineRef = useRef<number | null>(null);

  const assessmentActive = location.pathname.startsWith("/learn/assessments/");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) {
        setUserId(null);
        setLastActivityAt(null);
        return;
      }

      const existing = readActivity(user.id);
      const now = Date.now();
      const timestamp = existing ?? now;
      localStorage.setItem(activityKey(user.id), String(timestamp));
      lastPersistedRef.current = timestamp;
      lastActivityRef.current = timestamp;
      setUserId(user.id);
      setLastActivityAt(timestamp);
    }

    void loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (!session || event === "SIGNED_OUT") {
        if (userId) localStorage.removeItem(activityKey(userId));
        setUserId(null);
        setLastActivityAt(null);
        setWarningOpen(false);
        warningDeadlineRef.current = null;
      } else if (session.user.id !== userId) {
        const now = Date.now();
        localStorage.setItem(activityKey(session.user.id), String(now));
        lastPersistedRef.current = now;
        lastActivityRef.current = now;
        setUserId(session.user.id);
        setLastActivityAt(now);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const recordActivity = () => {
      if (warningOpen || assessmentActive) return;
      const now = Date.now();
      lastActivityRef.current = now;
      setLastActivityAt(now);
      if (now - lastPersistedRef.current >= ACTIVITY_WRITE_THROTTLE_MS) {
        localStorage.setItem(activityKey(userId), String(now));
        lastPersistedRef.current = now;
      }
    };

    const events: Array<keyof DocumentEventMap> = [
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "wheel",
      "scroll",
      "input",
      "change",
    ];

    events.forEach((eventName) => {
      document.addEventListener(eventName, recordActivity as EventListener, { passive: true });
    });

    const onVisibilityChange = () => {
      const stored = readActivity(userId);
      if (stored && stored !== lastActivityRef.current) {
        lastActivityRef.current = stored;
        setLastActivityAt(stored);
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== activityKey(userId) || !event.newValue) return;
      const timestamp = Number(event.newValue);
      if (!Number.isFinite(timestamp)) return;
      lastActivityRef.current = timestamp;
      setLastActivityAt(timestamp);
      if (!warningOpen) warningDeadlineRef.current = null;
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onStorage);
    return () => {
      events.forEach((eventName) => {
        document.removeEventListener(eventName, recordActivity as EventListener);
      });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId, warningOpen, assessmentActive]);

  useEffect(() => {
    if (!userId || assessmentActive) {
      setWarningOpen(false);
      warningDeadlineRef.current = null;
      return;
    }

    const evaluate = () => {
      const stored = readActivity(userId);
      const current = stored ?? lastActivityRef.current ?? Date.now();
      if (current !== lastActivityRef.current) {
        lastActivityRef.current = current;
        setLastActivityAt(current);
      }

      const age = Date.now() - current;
      if (age < IDLE_WARNING_MS) {
        if (warningOpen) setWarningOpen(false);
        warningDeadlineRef.current = null;
        setSecondsRemaining(300);
        return;
      }

      if (!warningOpen) {
        const deadline = current + IDLE_WARNING_MS + WARNING_GRACE_MS;
        warningDeadlineRef.current = deadline;
        setWarningOpen(true);
      }
    };

    evaluate();
    const interval = window.setInterval(evaluate, 1000);
    return () => window.clearInterval(interval);
  }, [userId, assessmentActive, warningOpen]);

  useEffect(() => {
    if (!warningOpen || !userId || assessmentActive) return;

    const tick = () => {
      const deadline = warningDeadlineRef.current ?? Date.now() + WARNING_GRACE_MS;
      warningDeadlineRef.current = deadline;
      const remainingMs = Math.max(0, deadline - Date.now());
      setSecondsRemaining(Math.ceil(remainingMs / 1000));
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [warningOpen, userId, assessmentActive]);

  useEffect(() => {
    if (!warningOpen || !userId || assessmentActive || secondsRemaining > 0 || signingOut) return;

    let mounted = true;
    async function expireSession() {
      setSigningOut(true);
      localStorage.removeItem(activityKey(userId));
      try {
        await signOut();
        if (mounted) await navigate({ to: "/learn/login", replace: true });
      } catch {
        if (mounted) setSigningOut(false);
      }
    }

    void expireSession();
    return () => {
      mounted = false;
    };
  }, [warningOpen, userId, assessmentActive, secondsRemaining, signingOut, navigate]);

  async function staySignedIn() {
    if (!userId || signingOut) return;
    const now = Date.now();
    localStorage.setItem(activityKey(userId), String(now));
    lastPersistedRef.current = now;
    lastActivityRef.current = now;
    setLastActivityAt(now);
    warningDeadlineRef.current = null;
    setSecondsRemaining(300);
    setWarningOpen(false);
  }

  async function signOutNow() {
    if (!userId || signingOut) return;
    setSigningOut(true);
    localStorage.removeItem(activityKey(userId));
    try {
      await signOut();
      await navigate({ to: "/learn/login", replace: true });
    } catch {
      setSigningOut(false);
    }
  }

  if (!warningOpen || assessmentActive) return null;

  const minutes = Math.floor(secondsRemaining / 60).toString().padStart(2, "0");
  const seconds = (secondsRemaining % 60).toString().padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020817]/80 p-4 backdrop-blur-sm" role="presentation">
      <div
        className="w-full max-w-md rounded-2xl border border-cyan-300/20 bg-[#101b2d] p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-description"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">Session security</div>
            <h2 id="session-timeout-title" className="mt-1 text-xl font-bold tracking-tight text-white">Are you still there?</h2>
            <p id="session-timeout-description" className="mt-2 text-sm leading-6 text-slate-300">
              You have been inactive for 15 minutes. For your security, you will be signed out in 5 minutes unless you stay signed in.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3">
          <Clock3 size={16} className="text-amber-300" aria-hidden="true" />
          <span className="text-sm text-slate-300">Automatic sign-out in</span>
          <span className="font-mono text-lg font-bold tabular-nums text-white" aria-live="polite">{minutes}:{seconds}</span>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => void signOutNow()}
            disabled={signingOut}
            className="learn-secondary-button justify-center"
          >
            <LogOut size={16} />
            Sign out now
          </button>
          <button
            type="button"
            onClick={() => void staySignedIn()}
            disabled={signingOut}
            className="learn-primary-button justify-center"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
