import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Bell, BookOpen, ChevronRight, CircleHelp, LayoutDashboard, Loader2, LogOut, Menu, MessageSquare, UserRound, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";
import logo from "@/assets/amit-logo.png";

const nav = [
  { label: "Feed", to: "/learn", icon: LayoutDashboard },
  { label: "Workshops", to: "/learn/workshops", icon: Users },
  { label: "Courses", to: "/learn/courses", icon: BookOpen },
  { label: "Messages", to: "/learn/messages", icon: MessageSquare },
] as const;

export function LearnShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const active = location.pathname;

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!data.user) {
        await navigate({ to: "/learn/login", replace: true });
        return;
      }

      setAuthChecked(true);
    }

    void checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted || session) return;
      void navigate({ to: "/learn/login", replace: true });
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      await navigate({ to: "/learn/login", replace: true });
    } catch {
      setSigningOut(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111f] text-white">
        <Loader2 size={24} className="animate-spin text-cyan-300" aria-label="Checking session" />
      </div>
    );
  }

  return (
    <div className="learn-app min-h-screen bg-[#07111f] text-white">
      <aside className={`learn-sidebar ${open ? "is-open" : ""}`}>
        <div className="flex items-center justify-between gap-3 px-5 py-5">
          <Link to="/learn" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <img src={logo} alt="AI Agents & Cloud Architecture Coach" className="h-10 w-auto" />
            <div className="hidden xl:block">
              <div className="font-display text-sm font-bold">Amit Soni</div>
              <div className="text-[10px] text-slate-400">Learning Hub</div>
            </div>
          </Link>
          <button className="learn-mobile-close lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="px-3 pt-4">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">Learn</div>
          <nav className="space-y-1">
            {nav.map(({ label, to, icon: Icon }) => {
              const isActive = to === "/learn" ? active === "/learn" : active.startsWith(to);
              return (
                <Link key={to} to={to} onClick={() => setOpen(false)} className={`learn-nav-item ${isActive ? "active" : ""}`}>
                  <Icon size={18} /><span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto space-y-1 px-3 pb-5">
          <Link to="/learn/profile" className="learn-nav-item"><UserRound size={18}/><span>Profile</span></Link>
          <Link to="/learn/help" className="learn-nav-item"><CircleHelp size={18}/><span>Help</span></Link>
          <button type="button" onClick={() => void handleSignOut()} disabled={signingOut} className="learn-nav-item w-full text-left disabled:opacity-60">
            {signingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18}/>}<span>{signingOut ? "Signing out…" : "Exit Learning Hub"}</span>
          </button>
        </div>
      </aside>

      {open && <button className="learn-overlay lg:hidden" aria-label="Close navigation" onClick={() => setOpen(false)} />}

      <div className="learn-main">
        <header className="learn-topbar">
          <button className="learn-menu-button lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20}/></button>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">Coach Amit Soni</div>
            <div className="truncate text-sm font-medium text-slate-300">AI Learning Hub</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/learn/notifications" className="learn-icon-button" aria-label="Notifications"><Bell size={18}/><span className="notification-dot" /></Link>
            <Link to="/learn/profile" className="learn-avatar" aria-label="Profile">AS</Link>
          </div>
        </header>
        <main className="learn-content">{children}</main>
      </div>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div><div className="learn-eyebrow">{eyebrow}</div><h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>}</div>
    {action}
  </div>;
}

export function ContinueCard() {
  return <div className="learn-card overflow-hidden p-0">
    <div className="h-1 bg-gradient-to-r from-cyan-400 via-violet-500 to-orange-400" />
    <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
      <div><div className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Continue learning</div><h2 className="mt-2 text-xl font-bold">Build Your First AI Agent</h2><p className="mt-2 text-sm leading-6 text-slate-400">Continue the practical agent-building path with n8n, ChatGPT and real workflow automation.</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full w-[42%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" /></div><div className="mt-2 text-xs text-slate-500">42% complete</div></div>
      <Link to="/learn/courses" className="learn-primary-button">Continue <ChevronRight size={16}/></Link>
    </div>
  </div>;
}
