import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...cors, "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Authorization required");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw new Error("Unable to verify Admin role");
    if (profile?.role !== "admin") throw new Error("Admin access required");
    const { to, subject, html } = await req.json();
    if (typeof to !== "string" || typeof subject !== "string" || typeof html !== "string") throw new Error("to, subject and html are required");
    const key = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("LEARNING_EMAIL_FROM");
    if (!key || !from) return new Response(JSON.stringify({ ok: false, configured: false, message: "Email provider is not configured yet." }), { status: 200, headers: jsonHeaders });
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const body = await response.text();
    let parsed: unknown = body;
    try { parsed = JSON.parse(body); } catch { /* keep text response */ }
    if (!response.ok) return new Response(JSON.stringify({ ok: false, provider: "resend", status: response.status, error: parsed }), { status: 502, headers: jsonHeaders });
    return new Response(JSON.stringify({ ok: true, provider: "resend", status: response.status, response: parsed }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }), { status: 400, headers: jsonHeaders });
  }
});
