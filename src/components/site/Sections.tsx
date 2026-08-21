import { ArrowRight, Bot, BriefcaseBusiness, CheckCircle2, Gauge, Linkedin, Mic2, Network, PlayCircle, Quote, Sparkles, TrendingUp, Users, Workflow } from "lucide-react";
import { Reveal } from "./Reveal";
import { AUDIENCE, EMAIL, LINKEDIN_URL, OFFERS, SKILLS, WORKSHOP_HIGHLIGHTS } from "./content";

const ICONS: Record<string, any> = { bot: Bot, gauge: Gauge, briefcase: BriefcaseBusiness, linkedin: Linkedin, trending: TrendingUp };

function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return <Reveal><p className="eyebrow">{eyebrow}</p><h2 className="mt-3 max-w-3xl text-3xl font-bold sm:text-4xl">{title}</h2>{lead && <p className="mt-4 max-w-2xl text-muted-foreground">{lead}</p>}</Reveal>;
}

export function About() {
  return <section id="about" className="py-24"><div className="mx-auto grid max-w-7xl gap-12 px-5 md:px-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center"><Reveal><div className="about-visual panel"><div className="about-orbit orbit-one"/><div className="about-orbit orbit-two"/><div className="about-center"><Sparkles className="h-8 w-8 text-primary"/><span>AI + Cloud</span></div><div className="about-chip chip-one">Teach</div><div className="about-chip chip-two">Build</div><div className="about-chip chip-three">Automate</div><div className="about-chip chip-four">Lead</div></div></Reveal><div><SectionHeading eyebrow="About" title="From enterprise technology to AI & Cloud Architecture"/><Reveal delay={100}><div className="mt-6 space-y-5 text-muted-foreground"><p>19+ years in enterprise technology, working across organizations such as Accenture, Oracle and 3i Infotech, with a focus on enterprise product & services technology, cloud and AI delivery.</p><p>I’m moving into AI education with a practical focus: helping professionals build AI agents, voice agents and no-code automations using tools such as n8n, Bolna AI and ChatGPT, while connecting Generative AI with real-world cloud and architecture thinking.</p><p>My approach is hands-on: build something rather than just watch slides, learn through actual implementation, and turn technical knowledge into practical outcomes.</p><p className="border-l-2 border-primary pl-5 font-display text-lg leading-snug text-foreground">“AI won't replace professionals — but professionals who know how to use AI will outperform those who don't.”</p></div></Reveal></div></div></section>;
}

export function Offers() {
  return <section className="bg-surface/35 py-24"><div className="mx-auto max-w-7xl px-5 md:px-6"><SectionHeading eyebrow="What I Help You Achieve" title="Practical outcomes, not AI theory" lead="Build useful skills, working agents and automations you can apply in your career and business."/><div id="courses" className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{OFFERS.map((offer,i)=>{const Icon=ICONS[offer.icon] ?? Bot; return <Reveal key={offer.title} delay={i*60} as="article" className="offer-card panel panel-hover p-7"><div className="offer-icon"><Icon className="h-5 w-5"/></div><h3 className="mt-5 text-lg font-semibold">{offer.title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{offer.body}</p><a href="#contact" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">Explore <ArrowRight className="h-4 w-4"/></a></Reveal>})}</div></div></section>;
}

export function Experience() {
  return <section id="experience" className="py-24"><div className="mx-auto max-w-7xl px-5 md:px-6"><SectionHeading eyebrow="Experience" title="A journey from enterprise technology to AI education" lead="Detailed career milestones will be added in a future update; the Phase 1 site keeps the story focused on the evolution of expertise."/><div className="mt-12 grid gap-4 md:grid-cols-5">{["Enterprise Technology","Product & Services Technology","Cloud","AI & Automation","AI Education & Coaching"].map((item,i)=><Reveal key={item} delay={i*70} className="journey-card panel p-6"><span className="journey-number">0{i+1}</span><h3 className="mt-8 text-lg font-semibold">{item}</h3><div className="journey-line"/></Reveal>)}</div></div></section>;
}

export function Skills() {
  return <section id="skills" className="bg-surface/35 py-24"><div className="mx-auto max-w-7xl px-5 md:px-6"><SectionHeading eyebrow="Skills & AI Expertise" title="The tools and capabilities I teach and build with"/><Reveal delay={100} className="mt-10 flex flex-wrap gap-3">{SKILLS.map((skill,i)=><span key={skill} className={`skill-pill ${i%4===0?'skill-cyan':i%4===1?'skill-purple':i%4===2?'skill-orange':''}`}><CheckCircle2 className="h-3.5 w-3.5"/>{skill}</span>)}</Reveal></div></section>;
}

export function Workshops() {
  return <section id="workshops" className="py-24"><div className="mx-auto max-w-7xl px-5 md:px-6"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><SectionHeading eyebrow="Live Workshops" title="Live, hands-on AI agent & Cloud workshops" lead="Build alongside the instructor and leave with practical implementation experience."/><a href="#contact" className="btn-base btn-outline-soft shrink-0">View All Workshops <ArrowRight className="h-4 w-4"/></a></div><div className="mt-12 grid gap-5 md:grid-cols-3">{WORKSHOP_HIGHLIGHTS.map((item,i)=><Reveal key={item.title} delay={i*70} className="panel panel-hover p-7"><div className="workshop-icon"><PlayCircle className="h-5 w-5"/></div><h3 className="mt-5 text-lg font-semibold">{item.title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p></Reveal>)}</div><div className="mt-10 grid gap-8 rounded-3xl border border-primary/15 bg-primary/5 p-7 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="eyebrow">Who it is for</p><div className="mt-4 flex flex-wrap gap-2">{AUDIENCE.map(x=><span key={x} className="audience-pill">{x}</span>)}</div></div><div className="flex flex-wrap gap-3"><a href="#contact" className="btn-base btn-cyan">View Upcoming Workshops</a><a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="btn-base btn-outline-soft">Invite Amit to Chat</a></div></div></div></section>;
}

export function Testimonials() { return null; }

export function Books() { return null; }
export function Credibility() { return null; }
