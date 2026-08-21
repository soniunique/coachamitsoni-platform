import { ArrowRight, Bot, BrainCircuit, GitBranch, Sparkles, Workflow } from "lucide-react";
import { Reveal } from "./Reveal";
import { LINKEDIN_URL } from "./content";

function AgentVisual() {
  return (
    <div className="agent-visual panel relative overflow-hidden p-4 sm:p-5" aria-label="AI agent workflow visualization">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_20%_80%,rgba(168,85,247,.18),transparent_30%)]" />
      <div className="relative flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <p className="eyebrow">AI Agent Studio</p>
          <p className="mt-1 text-xs text-muted-foreground">Build · Automate · Scale</p>
        </div>
        <span className="status-dot"><span /> Live</span>
      </div>
      <div className="relative mt-5 grid grid-cols-2 gap-3">
        {[
          { icon: BrainCircuit, title: "Generative AI", sub: "Reasoning" },
          { icon: Workflow, title: "Automation", sub: "n8n workflows" },
          { icon: GitBranch, title: "RAG", sub: "Grounded answers" },
          { icon: Bot, title: "Voice Agent", sub: "Real-time action" },
        ].map(({ icon: Icon, title, sub }) => (
          <div key={title} className="agent-node">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/8 text-primary"><Icon className="h-4 w-4" /></span>
            <div className="min-w-0"><p className="truncate text-xs font-semibold">{title}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{sub}</p></div>
          </div>
        ))}
      </div>
      <div className="relative mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center justify-between"><span className="text-xs font-semibold">Agent workflow</span><span className="text-[10px] text-primary">ACTIVE</span></div>
        <div className="workflow-line mt-4"><span /><span /><span /><span /></div>
        <div className="mt-3 flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground"><span>Input</span><span>Reason</span><span>Act</span><span>Outcome</span></div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-0 md:pt-40">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-14 md:px-6 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:gap-16 lg:pb-16">
        <div>
          <Reveal><span className="pill gap-2 text-primary"><Sparkles className="h-3.5 w-3.5" />AI Agents & Cloud Architecture Coach · Noida, India</span></Reveal>
          <Reveal delay={80}><h1 className="mt-6 max-w-3xl text-4xl leading-[1.04] font-bold sm:text-5xl lg:text-[4.3rem]">AI Agents Educator <span className="text-muted-foreground">|</span> Cloud Architecture<span className="mt-3 block text-gradient-cyan">Empowering Professionals to Build with AI & Cloud</span></h1></Reveal>
          <Reveal delay={160}><p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">19+ years turning enterprise product experience into practical AI skills for working professionals.</p></Reveal>
          <Reveal delay={220}><div className="mt-8 flex flex-wrap gap-3"><a href="#workshops" className="btn-base btn-cyan">Join a Workshop <ArrowRight className="h-4 w-4" /></a><a href="#about" className="btn-base btn-outline-soft">Read My Story</a><a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="btn-base btn-outline-soft">LinkedIn Profile</a></div></Reveal>
          <Reveal delay={280} className="mt-8 flex flex-wrap items-center gap-4 text-sm text-muted-foreground"><span className="credential-badge">Amazon Bestselling Author</span><span>Speaker · Community Builder</span></Reveal>
        </div>
        <Reveal delay={140}><AgentVisual /></Reveal>
      </div>
      <ImpactStats />
    </section>
  );
}

function ImpactStats() {
  const stats = [
    ["100+", "Live Workshops Delivered"],
    ["500+", "Professionals Trained"],
    ["100+", "Active Community Members"],
    ["30+", "Cloud/AI Implementations"],
  ];
  return <div className="relative mx-auto max-w-7xl px-5 pb-10 md:px-6"><div className="impact-strip"><div className="impact-glow" />{stats.map(([value,label]) => <div key={label} className="impact-stat"><strong>{value}</strong><span>{label}</span></div>)}</div></div>;
}
