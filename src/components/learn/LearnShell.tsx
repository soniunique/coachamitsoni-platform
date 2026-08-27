import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Bell, BookOpen, CircleHelp, LayoutDashboard, Loader2, LogOut, Menu, MessageSquare, UserCheck, UserRound, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";
import logo from "@/assets/amit-logo.png";
import "@/styles-reference-lms.css";

const primaryNav = [
  { label: "Feed", to: "/learn", icon: LayoutDashboard },
  { label: "Workshops", to: "/learn/workshops", icon: Users },
  { label: "Courses", to: "/learn/courses", icon: BookOpen },
  { label: "Messages", to: "/learn/messages", icon: MessageSquare },
] as const;

export function LearnShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const active = location.pathname;
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!data.user) { await navigate({ to: "/learn/login", replace: true }); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (!mounted) return;
      setIsAdmin(profile?.role === "admin"); setAuthChecked(true);
    }
    void checkSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => { if (!mounted || session) return; setIsAdmin(false); void navigate({ to: "/learn/login", replace: true }); });
    return () => { mounted = false; authListener.subscription.unsubscribe(); };
  }, [navigate]);
  async function handleSignOut() { setSigningOut(true); try { await signOut(); await navigate({ to: "/learn/login", replace: true }); } catch { setSigningOut(false); } }
  if (!authChecked) return <div className="flex min-h-screen items-center justify-center bg-white text-slate-700"><Loader2 size={24} className="animate-spin text-amber-500" aria-label="Checking session" /></div>;
  const isNavActive = (to: string) => to === "/learn" ? active === "/learn" : active.startsWith(to);
  return <div className="reference-lms min-h-screen">
    <aside className={`learn-sidebar ${open ? "is-open" : ""}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-5"><Link to="/learn" onClick={() => setOpen(false)}><img src={logo} alt="Coach Amit Soni" className="h-10 w-auto" /></Link><button className="learn-mobile-close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="flex-1 overflow-y-auto px-3 pt-4"><nav className="space-y-1">{primaryNav.map(({label,to,icon:Icon}) => <Link key={to} to={to} onClick={() => setOpen(false)} className={`learn-nav-item ${isNavActive(to) ? "active" : ""}`}><Icon size={18}/><span>{label}</span></Link>)}{isAdmin&&<><div className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">Admin</div><Link to="/learn/manage/courses" onClick={()=>setOpen(false)} className="learn-nav-item"><BookOpen size={18}/><span>Course Manager</span></Link><Link to="/learn/manage/enrolments" onClick={()=>setOpen(false)} className="learn-nav-item"><UserCheck size={18}/><span>Enrolments</span></Link></>}</nav></div>
      <div className="space-y-1 px-3 pb-5"><Link to="/learn/profile" onClick={()=>setOpen(false)} className="learn-nav-item"><UserRound size={18}/><span>Profile</span></Link><Link to="/learn/help" onClick={()=>setOpen(false)} className="learn-nav-item"><CircleHelp size={18}/><span>Help</span></Link><button type="button" onClick={()=>void handleSignOut()} disabled={signingOut} className="learn-nav-item w-full text-left disabled:opacity-60">{signingOut?<Loader2 size={18} className="animate-spin"/>:<LogOut size={18}/>}<span>{signingOut?"Signing out…":"Exit Learning Hub"}</span></button></div>
    </aside>
    {open&&<button className="learn-overlay" aria-label="Close navigation" onClick={()=>setOpen(false)}/>} 
    <div className="learn-main">
      <header className="learn-topbar"><div className="learn-topbar-brand"><Link to="/learn" onClick={()=>setOpen(false)}><img src={logo} alt="Coach Amit Soni" /></Link></div><button className="learn-menu-button" onClick={()=>setOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><nav className="learn-topnav" aria-label="Primary navigation">{primaryNav.map(({label,to,icon:Icon})=><Link key={to} to={to} className={`learn-topnav-item ${isNavActive(to)?"active":""}`}><Icon size={17}/><span>{label}</span></Link>)}</nav><div className="ml-auto flex items-center gap-3"><Link to="/learn/notifications" className="learn-icon-button" aria-label="Notifications"><Bell size={19}/><span className="notification-dot"/></Link><Link to="/learn/profile" className="learn-avatar" aria-label="Profile">AS</Link></div></header>
      {isAdmin&&<div className="reference-adminbar"><span>Admin</span><Link to="/learn/manage/courses">Course Manager</Link><Link to="/learn/manage/enrolments">Enrolments</Link></div>}
      <main className="learn-content">{children}</main>
    </div>
  </div>;
}

export function SectionHeader({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:React.ReactNode}){return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="learn-eyebrow">{eyebrow}</div><h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>{description&&<p className="mt-2 max-w-2xl text-sm leading-6">{description}</p>}</div>{action}</div>}

export function ContinueCard(){return <div className="learn-card overflow-hidden p-0"><div className="h-1 bg-gradient-to-r from-amber-300 to-amber-500"/><div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center"><div><div className="text-xs font-semibold uppercase tracking-[.18em] text-amber-600">Continue learning</div><h2 className="mt-2 text-xl font-bold">Your next lesson</h2><p className="mt-2 text-sm leading-6">Open Courses to continue from the course you last worked on.</p></div><Link to="/learn/courses" className="learn-primary-button">My Learning <span aria-hidden="true">→</span></Link></div></div>}
