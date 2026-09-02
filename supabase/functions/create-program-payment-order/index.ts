import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { program_id, email, full_name } = await req.json();
    if (!program_id || typeof program_id !== "string") return json({ error: "program_id is required" }, 400);
    const guestEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const guestName = typeof full_name === "string" ? full_name.trim() : "";
    if (!emailPattern.test(guestEmail)) return json({ error: "A valid email address is required." }, 400);
    if (guestName.length < 2) return json({ error: "Full name is required." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: program, error: programError } = await supabase.from("programs").select("id,title,payment_enabled,price_inr,status").eq("id", program_id).maybeSingle();
    if (programError) return json({ error: programError.message }, 400);
    if (!program) return json({ error: "Program not found" }, 404);
    if (program.status !== "published") return json({ error: "This program is not available for purchase." }, 400);
    if (!program.payment_enabled) return json({ error: "Paid enrollment is not enabled for this program." }, 400);

    const priceInr = Number(program.price_inr ?? 0);
    if (!Number.isFinite(priceInr) || priceInr <= 0) return json({ error: "Program price is not configured." }, 400);

    const authHeader = req.headers.get("Authorization");
    let authenticatedUserId: string | null = null;
    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        authenticatedUserId = user.id;
        if (user.email?.toLowerCase() !== guestEmail) return json({ error: "Use the email address associated with your signed-in account." }, 400);
      }
    }

    if (authenticatedUserId) {
      const { data: existingEnrollment } = await supabase.from("program_enrollments").select("id,status").eq("program_id", program_id).eq("user_id", authenticatedUserId).in("status", ["active", "completed"]).maybeSingle();
      if (existingEnrollment) return json({ error: "You already have access to this program." }, 409);
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) return json({ error: "Payment service is not configured." }, 500);
    const receipt = `prog_${program_id.slice(0, 8)}_${crypto.randomUUID().slice(0, 8)}`;
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(priceInr * 100), currency: "INR", receipt, notes: { program_id, guest_email: guestEmail, guest_name: guestName } }),
    });
    const razorpayOrder = await razorpayResponse.json();
    if (!razorpayResponse.ok) return json({ error: razorpayOrder?.error?.description ?? "Unable to create payment order." }, 502);

    const { error: orderInsertError } = await supabase.from("program_orders").insert({ user_id: authenticatedUserId, program_id, amount_inr: priceInr, currency: "INR", status: "created", provider: "razorpay", provider_order_id: razorpayOrder.id, metadata: { receipt, guest_email: guestEmail, guest_name: guestName } });
    if (orderInsertError) return json({ error: orderInsertError.message }, 500);

    return json({ key_id: keyId, order_id: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, program_id, program_title: program.title });
  } catch (error) {
    console.error("create-program-payment-order error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected payment error." }, 500);
  }
});
