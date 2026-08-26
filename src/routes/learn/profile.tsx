import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/profile")({ component: Profile });

function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("student");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setLoading(true); setError("");
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) { setError(userError.message); setLoading(false); return; }
      if (!user) { setError("You are not signed in."); setLoading(false); return; }
      setEmail(user.email ?? "");
      const { data, error: profileError } = await supabase.from("profiles").select("full_name, avatar_url, bio, role").eq("id", user.id).maybeSingle();
      if (profileError) { setError(profileError.message); setLoading(false); return; }
      if (data) { setFullName(data.full_name ?? ""); setAvatarUrl(data.avatar_url ?? ""); setBio(data.bio ?? ""); setRole(data.role ?? "student"); }
      setLoading(false);
    }
    void loadProfile();
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { setError(userError?.message ?? "You are not signed in."); setSaving(false); return; }
    const { error: updateError } = await supabase.from("profiles").update({ full_name: fullName.trim() || null, bio: bio.trim() || null, avatar_url: avatarUrl.trim() || null }).eq("id", user.id);
    if (updateError) { setError(updateError.message); setSaving(false); return; }
    setSuccess("Profile saved successfully."); setSaving(false);
  }

  const initials = fullName.trim().split(/\s+/).filter(Boolean).slice(0,2).map(name=>name[0]?.toUpperCase()).join("") || "AS";

  return <LearnShell>
    <SectionHeader eyebrow="Account" title="Profile" description="Manage your profile and learning identity." />
    {loading ? <div className="learn-card flex items-center gap-3 p-6 text-slate-400"><Loader2 size={18} className="animate-spin"/>Loading your profile...</div> : <form onSubmit={saveProfile} className="space-y-5">
      <div className="learn-card p-6"><div className="flex items-center gap-4"><div className="learn-avatar flex items-center justify-center overflow-hidden" style={{height:72,width:72}}>{avatarUrl ? <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover"/> : <span className="font-semibold">{initials}</span>}</div><div><h2 className="text-xl font-bold">{fullName || "Student profile"}</h2><p className="text-sm text-slate-400">{email}</p><p className="mt-1 text-xs uppercase tracking-wide text-cyan-300">{role}</p>{["coach","admin"].includes(role) && <a href="/learn/manage/courses" className="mt-2 inline-block text-xs font-semibold text-cyan-300 hover:text-cyan-200">Open Course Manager →</a>}</div></div></div>
      {error && <div className="learn-card border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
      {success && <div className="learn-card border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300" role="status">{success}</div>}
      <div className="learn-card space-y-5 p-6">
        <div><label htmlFor="full-name" className="mb-2 block text-sm font-medium text-slate-200">Full name</label><input id="full-name" value={fullName} onChange={e=>setFullName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60" placeholder="Enter your full name" /></div>
        <div><label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">Email</label><input id="email" value={email} readOnly className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400 outline-none"/><p className="mt-2 text-xs text-slate-500">Your login email is managed by Supabase Authentication.</p></div>
        <div><label htmlFor="avatar-url" className="mb-2 block text-sm font-medium text-slate-200">Avatar URL</label><input id="avatar-url" type="url" value={avatarUrl} onChange={e=>setAvatarUrl(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60" placeholder="https://..." /></div>
        <div><label htmlFor="bio" className="mb-2 block text-sm font-medium text-slate-200">Bio</label><textarea id="bio" value={bio} onChange={e=>setBio(e.target.value)} rows={5} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60" placeholder="Tell us a little about yourself" /></div>
        <div className="flex justify-end"><button type="submit" className="learn-primary-button" disabled={saving}>{saving ? <><Loader2 size={17} className="animate-spin"/>Saving...</> : <><Save size={17}/>Save profile</>}</button></div>
      </div>
    </form>}
  </LearnShell>;
}
