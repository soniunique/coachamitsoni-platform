import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Clock3, ExternalLink, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/workshops")({ component: Workshops });

type Workshop = { id: string; slug: string; title: string; description: string | null; starts_at: string | null; ends_at: string | null; format: string | null; status: string; meeting_url: string | null };
type Registration = { workshop_id: string; status: string };

function dateLabel(value: string | null) {
  if (!value) return "Date to be announced";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
function timeLabel(start: string | null, end: string | null) {
  if (!start) return "Time to be announced";
  const fmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  return end ? `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}` : fmt.format(new Date(start));
}

function Workshops() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [registrations, setRegistrations] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data, error: workshopError } = await supabase.from("workshops").select("id,slug,title,description,starts_at,ends_at,format,status,meeting_url").in("status", ["upcoming", "completed"]).order("starts_at", { ascending: true });
    if (workshopError) { setError(workshopError.message); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    let regMap = new Map<string, string>();
    if (user && data?.length) {
      const { data: regs } = await supabase.from("workshop_registrations").select("workshop_id,status").eq("user_id", user.id).in("workshop_id", data.map((item) => item.id));
      regMap = new Map(((regs ?? []) as Registration[]).map((item) => [item.workshop_id, item.status]));
    }
    setWorkshops((data ?? []) as Workshop[]); setRegistrations(regMap); setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function register(workshopId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setError("");
    const { error: registrationError } = await supabase.from("workshop_registrations").upsert({ user_id: user.id, workshop_id: workshopId, status: "registered" }, { onConflict: "user_id,workshop_id" });
    if (registrationError) setError(registrationError.message); else setRegistrations((current) => new Map(current).set(workshopId, "registered"));
  }

  return <LearnShell>
    <SectionHeader eyebrow="Live learning" title="Workshops" description="Upcoming live workshops, session details and your Zoom joining link." />
    {error && <div className="learn-alert error mb-5">{error}</div>}
    {loading ? <div className="learn-card p-8 text-sm">Loading workshops...</div> : workshops.length === 0 ? <div className="learn-card learn-empty"><div className="mx-auto learn-icon-tile"><CalendarDays size={20}/></div><h2 className="mt-5 text-xl font-bold">No workshops scheduled</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6">Upcoming workshops will appear here when the learning team publishes them.</p></div> : <div className="space-y-4">{workshops.map((workshop) => { const registered = registrations.get(workshop.id) === "registered" || registrations.get(workshop.id) === "attended"; const completed = workshop.status === "completed"; return <article key={workshop.id} className={`reference-workshop-card ${completed ? "completed" : "upcoming"}`}><div className="reference-workshop-grid"><div><div className={`reference-workshop-status ${completed ? "completed" : ""}`}>{completed ? <CheckCircle2 size={13}/> : <Video size={13}/>} {completed ? "Completed workshop" : "Upcoming workshop"}</div><h2 className="mt-2 text-xl font-bold">{workshop.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6">{workshop.description || "A live practical session from Coach Amit Soni."}</p><div className="reference-workshop-meta"><span><CalendarDays size={13}/>{dateLabel(workshop.starts_at)}</span><span><Clock3 size={13}/>{timeLabel(workshop.starts_at, workshop.ends_at)}</span><span><Video size={13}/>{workshop.format || "Online"}</span></div>{registered && !completed && workshop.meeting_url && <p className="reference-workshop-note">You are registered. Use Join Zoom when the session is ready.</p>}</div><div className="reference-workshop-actions">{completed ? <span className="text-xs font-semibold text-slate-500">Session ended</span> : registered ? workshop.meeting_url ? <a className="reference-join-button" href={workshop.meeting_url} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Join Zoom</a> : <span className="text-xs text-slate-500">Zoom link will be added by admin.</span> : <button type="button" className="reference-register-button" onClick={() => void register(workshop.id)}>Register for workshop</button>}</div></div></article>; })}</div>}
  </LearnShell>;
}
