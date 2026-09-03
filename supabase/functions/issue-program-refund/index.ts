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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Administrator authentication required." }, 401);

  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!razorpayKeyId || !razorpayKeySecret) return json({ error: "Razorpay service is not configured." }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  try {
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Administrator authentication required." }, 401);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) return json({ error: profileError.message }, 500);
    if (profile?.role !== "admin") return json({ error: "Administrator access required." }, 403);

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.order_id === "string" ? body.order_id : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "Admin refund";
    if (!orderId) return json({ error: "Payment order is required." }, 400);

    const { data: order, error: orderError } = await supabase
      .from("program_orders")
      .select("id,user_id,program_id,amount_inr,currency,status,provider_order_id,provider_payment_id,metadata")
      .eq("id", orderId)
      .eq("provider", "razorpay")
      .maybeSingle();
    if (orderError) return json({ error: orderError.message }, 500);
    if (!order) return json({ error: "Payment order not found." }, 404);
    if (order.status !== "paid") return json({ error: "Only paid orders can be refunded from the LMS." }, 400);
    if (!order.provider_payment_id) return json({ error: "The paid order has no Razorpay payment ID." }, 400);

    const { data: existingRefunds, error: refundsError } = await supabase
      .from("program_refunds")
      .select("id,amount_inr,status,razorpay_refund_id")
      .eq("program_order_id", order.id)
      .in("status", ["pending", "processed"]);
    if (refundsError) return json({ error: refundsError.message }, 500);
    const committed = (existingRefunds ?? []).reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0);
    const remaining = Number(order.amount_inr) - committed;
    if (remaining <= 0) return json({ error: "This payment has already been fully refunded or a full refund is already in progress." }, 400);

    const idempotencyKey = crypto.randomUUID();
    const { error: lockError } = await supabase
      .from("program_orders")
      .update({ status: "refund_pending" })
      .eq("id", order.id)
      .eq("status", "paid");
    if (lockError) return json({ error: lockError.message }, 500);

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const refundResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(order.provider_payment_id)}/refund`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
        "X-Refund-Idempotency": idempotencyKey,
      },
      body: JSON.stringify({
        amount: remaining * 100,
        speed: "normal",
        receipt: `lms_${order.id}`.slice(0, 40),
        notes: {
          program_order_id: order.id,
          program_id: order.program_id,
          initiated_by: user.id,
          reason: reason || "Admin refund",
        },
      }),
    });
    const refundPayload = await refundResponse.json().catch(() => ({}));

    if (!refundResponse.ok) {
      await supabase.from("program_orders").update({ status: "paid" }).eq("id", order.id).eq("status", "refund_pending");
      return json({ error: refundPayload?.error?.description || "Razorpay could not create the refund." }, refundResponse.status >= 400 && refundResponse.status < 600 ? refundResponse.status : 502);
    }

    const refundId = typeof refundPayload?.id === "string" ? refundPayload.id : "";
    if (!refundId) return json({ error: "Razorpay accepted the refund request but did not return a refund ID." }, 502);

    const refundStatus = refundPayload?.status === "processed" ? "processed" : refundPayload?.status === "failed" ? "failed" : "pending";
    const { data: enrollment } = await supabase
      .from("program_enrollments")
      .select("id,status")
      .eq("user_id", order.user_id)
      .eq("program_id", order.program_id)
      .maybeSingle();

    const { error: refundInsertError } = await supabase.from("program_refunds").upsert({
      program_order_id: order.id,
      enrollment_id: enrollment?.id ?? null,
      razorpay_payment_id: order.provider_payment_id,
      razorpay_refund_id: refundId,
      amount_inr: remaining,
      currency: order.currency || "INR",
      status: refundStatus,
      speed_requested: refundPayload?.speed_requested ?? "normal",
      speed_processed: refundPayload?.speed_processed ?? null,
      reason: reason || "Admin refund",
      initiated_by: user.id,
      processed_at: refundStatus === "processed" ? new Date().toISOString() : null,
      idempotency_key: idempotencyKey,
    }, { onConflict: "razorpay_refund_id" });
    if (refundInsertError) return json({ error: refundInsertError.message }, 500);

    if (refundStatus === "processed") {
      await supabase.from("program_orders").update({ status: "refunded" }).eq("id", order.id);
      if (enrollment?.id) await supabase.from("program_enrollments").update({ status: "refunded" }).eq("id", enrollment.id);
    } else if (refundStatus === "failed") {
      await supabase.from("program_orders").update({ status: "paid" }).eq("id", order.id);
      if (enrollment?.id) await supabase.from("program_enrollments").update({ status: "active" }).eq("id", enrollment.id).eq("status", "refund_pending");
    } else if (enrollment?.id) {
      await supabase.from("program_enrollments").update({ status: "refund_pending" }).eq("id", enrollment.id).in("status", ["active", "completed"]);
    }

    return json({
      success: true,
      refund_id: refundId,
      status: refundStatus,
      amount_inr: remaining,
      message: refundStatus === "processed" ? "Refund processed and LMS access revoked." : "Refund initiated. LMS access is suspended until the refund reaches a final state.",
    });
  } catch (error) {
    console.error("issue-program-refund error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected refund error." }, 500);
  }
});
