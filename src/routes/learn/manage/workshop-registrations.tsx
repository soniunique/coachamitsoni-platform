import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Check, Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Workshop = { id: string; title: string; starts_at: string | null; ends_at: string | null; status: string };
type Registration = { id: string; user_id: string; workshop_id: string; status: string; registered_at: string };
type Profile = { id: string; full_name: string | null; role: string };

export const Route = createFileRoute("/learn/manage/workshop-registrations")({ component: Registrations });

function Registrations() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You are not signed in."); setLoading(false); return; }
    const { data: currentProfile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (currentProfile?.role !== "admin") { setError("Only admins can view workshop registrations."); setLoading(false); return; }

    const [{ data: workshopData, error: workshopError }, { data: registrationData, error: registrationError }] = await Promise.all([
      supabase.from("workshops").select("id,title,starts_at,ends_at,status").order("starts_at", { ascending: true, nullsFirst: false }),
      supabase.from("workshop_registrations").select("id,user_id,workshop_id,status,registered_at").order("registered_at", { ascending: false }),
    ]);
    if (workshopError || registrationError) { setError((workshopError || registrationError)?.message || "Unable to load registrations."); setLoading(false); return; }

    const rows = (registrationData || []) as Registration[];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    let studentProfiles: Profile[] = [];
    if (ids.length) {
      const { data, error: profileError } = await supabase.from("profiles").select("id,full_name,role").in("id", ids);
      if (profileError) { setError(profileError.message); setLoading(false); return; }
      studentProfiles = (data || []) as Profile[];
    }
    setWorkshops((workshopData || []) as Workshop[]);
    setRegistrations(rows);
    setProfiles(studentProfiles);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const registrationsByWorkshop = useMemo(() => {
    const map = new Map<string, Registration[]>();
    for (const workshop of workshops) map.set(workshop.id, []);
    for (const row of registrations) map.get(row.workshop_id)?.push(row);
    return map;
  }, [workshops, registrations]);

  const studentName = (id: string) => profiles.find((p) => p.id === id)?.full_name || "Student";

  async function updateStatus(id: string, status: string) {
    setSaving(id);
    setError("");
    const { error: updateError } = await supabase.from("workshop_registrations").update({ status }).eq("id", id);
    if (updateError) setError(updateError.message);
    else setRegistrations((current) => current.map((row) => row.id === id ? { ...row, status } : row));
    setSaving("");
  }

  if (loading) return <LearnShell><div className="learn-card p-6 text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={18} />Loading registrations...</div></LearnShell>;

  return <LearnShell>
    <div className="mb-5"><Link to="/learn/manage/workshops" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} />Back to Workshops</Link></div>
    <SectionHeader eyebrow="Admin · Live learning" title="Workshop registrations" description="See registrations and record attendance for every workshop." />
    {error && <div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {!workshops.length ? <div className="learn-card p-8 text-center text-sm text-slate-400">No workshops yet.</div> : <div className="space-y-5">
      {workshops.map((workshop) => {
        const rows = registrationsByWorkshop.get(workshop.id) || [];
        const activeCount = rows.filter((row) => row.status !== "cancelled").length;
        return <section key={workshop.id} className="learn-card p-6">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
            <div><span className={`learn-status-pill learn-status-${workshop.status.replace(/_/g,"-")}`}>{workshop.status}</span><h2 className="mt-2 text-xl font-bold">{workshop.title}</h2></div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              {workshop.starts_at && <span className="learn-meta"><CalendarDays size={14} />{new Date(workshop.starts_at).toLocaleString()}</span>}
              <span className="learn-meta"><Users size={14} />{activeCount} registered</span>
            </div>
          </div>
          {!rows.length ? <p className="py-8 text-center text-sm text-slate-400">No registrations yet.</p> : <div className="mt-5 space-y-3">
            {rows.map((row) => <div key={row.id} className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[.03] p-4 md:flex-row md:items-center md:justify-between">
              <div><div className="font-medium text-slate-200">{studentName(row.user_id)}</div><div className="mt-1 text-xs text-slate-500">Registered {new Date(row.registered_at).toLocaleString()}</div></div>
              <div className="flex items-center gap-2"><span className={`learn-status-pill learn-status-${row.status.replace(/_/g,"-")}`}>{row.status}</span>{row.status !== "attended" && row.status !== "cancelled" && <button type="button" disabled={saving === row.id} onClick={() => void updateStatus(row.id, "attended")} className="learn-primary-button">{saving === row.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Mark attended</button>}{row.status !== "cancelled" && row.status !== "attended" && <button type="button" disabled={saving === row.id} onClick={() => void updateStatus(row.id, "cancelled")} className="learn-secondary-button">Cancel</button>}</div>
            </div>)}
          </div>}
        </section>;
      })}
    </div>}
  </LearnShell>;
}
