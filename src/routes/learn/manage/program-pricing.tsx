import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, IndianRupee, Loader2, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Program = { id: string; title: string; slug: string; status: string; payment_enabled: boolean; price_inr: number };

export const Route = createFileRoute("/learn/manage/program-pricing")({ component: ProgramPricing });

function ProgramPricing() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You are not signed in."); setLoading(false); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) { setError(profileError.message); setLoading(false); return; }
    if (profile?.role !== "admin") { setError("Only admins can manage program pricing."); setLoading(false); return; }
    const { data, error: programError } = await (supabase as any).from("programs").select("id, title, slug, status, payment_enabled, price_inr").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    if (programError) setError(programError.message);
    setPrograms((data ?? []).map((p: any) => ({ ...p, payment_enabled: Boolean(p.payment_enabled), price_inr: Number(p.price_inr ?? 0) })));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function update(id: string, patch: Partial<Program>) {
    setPrograms(current => current.map(program => program.id === id ? { ...program, ...patch } : program));
    setError(""); setSuccess("");
  }

  async function save(program: Program) {
    if (program.payment_enabled && program.price_inr <= 0) { setError(`Enter a price greater than ₹0 for "${program.title}".`); return; }
    setSavingId(program.id); setError(""); setSuccess("");
    const { error: saveError } = await (supabase as any).from("programs").update({ payment_enabled: program.payment_enabled, price_inr: Math.round(program.price_inr) }).eq("id", program.id);
    if (saveError) setError(saveError.message); else setSuccess(`Payment settings saved for ${program.title}.`);
    setSavingId(null);
  }

  return <LearnShell>
    <SectionHeader eyebrow="Admin · Commerce" title="Program Pricing" description="Set the price and enable paid enrollment at the program level. A successful purchase will provide access to every course in that program." action={<Link to="/learn/manage/courses" className="learn-secondary-button"><ArrowLeft size={15}/>Programs & Courses</Link>} />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {success && <div className="learn-card mb-5 border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}
    {loading ? <div className="learn-card flex items-center gap-3 p-6 text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading program pricing...</div> : programs.length === 0 ? <div className="learn-card p-8 text-center text-sm text-slate-500">No programs available.</div> : <div className="space-y-5">{programs.map(program => <article key={program.id} className="learn-card p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">{program.title}</h2><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{program.status}</span></div><p className="mt-1 text-xs text-slate-500">{program.slug}</p><p className="mt-2 text-sm text-slate-400">Program-level purchase unlocks all courses inside this program.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="block min-w-48"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Price (₹)</span><div className="relative"><IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input type="number" min="1" step="1" value={program.price_inr || ""} onChange={e=>update(program.id,{price_inr:Math.max(0,Number(e.target.value)||0)})} className="learn-input w-full pl-9" placeholder="4999"/></div></label><label className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm"><input type="checkbox" checked={program.payment_enabled} onChange={e=>update(program.id,{payment_enabled:e.target.checked})} className="h-4 w-4 accent-cyan-400"/>Paid enrollment</label><button type="button" onClick={()=>void save(program)} disabled={savingId===program.id} className="learn-primary-button h-11">{savingId===program.id?<Loader2 size={15} className="animate-spin"/>:<Save size={15}/>}Save</button></div></div>{program.payment_enabled && <div className="mt-5 flex gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3 text-xs leading-5 text-slate-400"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-300"/><span>Checkout will use this server-controlled price. Payment verification will happen before enrollment is granted.</span></div>}</article>)}</div>}
  </LearnShell>;
}
