import { FormEvent, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/amit-logo.png";

export function AuthCard({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await navigate({ to: "/learn" });
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (error) throw error;
        setMessage("Account created. If email confirmation is enabled, check your inbox before signing in.");
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to complete this request."); }
    finally { setBusy(false); }
  }

  return <div className="learn-auth-shell">
    <div className="learn-auth-orb learn-auth-orb-a"/><div className="learn-auth-orb learn-auth-orb-b"/>
    <div className="learn-auth-card">
      <Link to="/" className="mb-8 flex justify-center"><img src={logo} alt="Amit Soni" className="h-16 w-auto" /></Link>
      <div className="text-center"><div className="learn-eyebrow">Coach Amit Soni</div><h1 className="mt-2 text-3xl font-bold">{mode === "login" ? "Welcome back" : "Create your student account"}</h1><p className="mt-2 text-sm leading-6 text-slate-400">{mode === "login" ? "Continue learning with your enrolled AI workshops and courses." : "Create your account first. Course and workshop access is provided after enrollment."}</p></div>
      <form onSubmit={submit} className="mt-7 space-y-4">
        {mode === "register" && <label className="block text-sm font-medium">Full name<input className="learn-input mt-2" value={name} onChange={e=>setName(e.target.value)} required placeholder="Your name" /></label>}
        <label className="block text-sm font-medium">Email<input className="learn-input mt-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com" /></label>
        <label className="block text-sm font-medium">Password<div className="relative mt-2"><input className="learn-input pr-11" type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} placeholder="8+ chars, upper/lowercase, number & symbol" /><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        {error && <div className="learn-alert error">{error}</div>}
        {message && <div className="learn-alert success">{message}</div>}
        <button className="learn-primary-button w-full" disabled={busy}>{busy ? <Loader2 size={17} className="animate-spin"/> : <ShieldCheck size={17}/>} {mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      {mode === "login" ? <div className="mt-6 flex justify-between text-sm"><Link className="text-cyan-300 hover:text-cyan-200" to="/learn/register">Create account</Link><Link className="text-slate-400 hover:text-white" to="/learn/forgot-password">Forgot password?</Link></div> : <div className="mt-6 text-center text-sm text-slate-400">Already registered? <Link className="text-cyan-300" to="/learn/login">Sign in</Link></div>}
      <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-slate-500"><ShieldCheck size={14}/> Secure account access powered by Supabase</div>
    </div>
  </div>;
}
