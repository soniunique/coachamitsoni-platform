import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Contact";
import { ProgramPurchaseButton } from "@/components/learn/ProgramPurchaseButton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/courses")({
  head: () => ({ meta: [
    { title: "Courses & Programs — Amit Soni" },
    { name: "description", content: "Explore AI learning programs and unlock practical courses with Coach Amit Soni." },
  ] }),
  component: PublicCourses,
});

type Program = { id: string; title: string; description: string | null; slug: string; payment_enabled: boolean; price_inr: number };

function PublicCourses() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: programData, error: programError } = await (supabase as any)
        .from("programs")
        .select("id,title,description,slug,payment_enabled,price_inr")
        .eq("status", "published")
        .order("sort_order", { ascending: true });
      if (programError) setError(programError.message);
      setPrograms((programData ?? []).map((p: any) => ({
        ...p,
        payment_enabled: Boolean(p.payment_enabled),
        price_inr: Number(p.price_inr ?? 0),
      })));
      setLoading(false);
    }
    void load();
  }, []);

  return <div className="min-h-screen bg-background"><Header/><main className="pt-28 pb-24"><section className="mx-auto max-w-7xl px-5 md:px-6"><div className="max-w-3xl"><p className="eyebrow">AI Learning Programs</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">Learn by building, not just watching.</h1><p className="mt-5 text-base leading-7 text-muted-foreground">Choose a program, unlock the courses inside it, and build practical AI skills you can apply at work and in your business.</p></div>{loading?<div className="mt-12 flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={18}/>Loading programs...</div>:error?<div className="mt-12 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">{error}</div>:<div className="mt-12 grid gap-6 lg:grid-cols-2">{programs.map(program=><article key={program.id} className="panel panel-hover overflow-hidden p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Program</p><h2 className="mt-2 text-2xl font-bold">{program.title}</h2></div>{program.payment_enabled&&program.price_inr>0?<div className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-bold text-primary">₹{Math.round(program.price_inr).toLocaleString("en-IN")}</div>:<div className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs font-semibold text-emerald-300">Free access</div>}</div>{program.description&&<p className="mt-4 text-sm leading-6 text-muted-foreground">{program.description}</p>}{program.payment_enabled&&program.price_inr>0?<><div className="mt-7 flex gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary"/><span>Secure Razorpay checkout</span></div><ProgramPurchaseButton programId={program.id} programTitle={program.title} priceInr={program.price_inr}/></>:<Link to="/learn/login" className="btn-base btn-outline-soft mt-7 w-full">Student Login to access</Link>}</article>)}</div>}{!loading&&!error&&!programs.length&&<div className="mt-12 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No published programs are available yet.</div>}</section></main><Footer/></div>;
}
