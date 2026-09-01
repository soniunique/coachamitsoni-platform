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

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new Error("Unable to verify Admin role");
    if (profile?.role !== "admin") throw new Error("Admin access required");

    const body = await req.json().catch(() => ({}));
    const userIds = Array.isArray(body.user_ids)
      ? body.user_ids.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (!userIds.length) {
      return new Response(JSON.stringify({ students: [] }), { status: 200, headers: jsonHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: { id: string; email: string | null }[] = [];
    for (const id of userIds) {
      const { data, error } = await adminClient.auth.admin.getUserById(id);
      if (!error && data.user) results.push({ id, email: data.user.email ?? null });
    }

    return new Response(JSON.stringify({ students: results }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: jsonHeaders },
    );
  }
});
