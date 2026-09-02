import { createClient } from "npm:@supabase/supabase-js@2";

type OrderForEmail = {
  id: string;
  program_id: string;
  amount_inr: number;
  currency: string;
  provider_order_id: string;
  provider_payment_id?: string | null;
  metadata: Record<string, unknown> | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendProgramPaymentConfirmation(
  supabase: ReturnType<typeof createClient>,
  order: OrderForEmail,
  programTitle: string,
  paymentId?: string | null,
) {
  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const recipient = typeof metadata.guest_email === "string"
    ? metadata.guest_email.trim().toLowerCase()
    : "";
  const name = typeof metadata.guest_name === "string"
    ? metadata.guest_name.trim()
    : "Student";

  if (!recipient) return { sent: false, skipped: true, reason: "missing_recipient" };

  const { data: existing } = await supabase
    .from("program_order_emails")
    .select("status")
    .eq("order_id", order.id)
    .eq("email_type", "payment_enrollment_confirmation")
    .maybeSingle();

  if (existing?.status === "sent") return { sent: true, alreadySent: true };
  if (existing?.status === "pending") return { sent: false, pending: true };

  const { error: claimError } = await supabase
    .from("program_order_emails")
    .upsert({
      order_id: order.id,
      email_type: "payment_enrollment_confirmation",
      recipient_email: recipient,
      status: "pending",
      error_message: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "order_id" });

  if (claimError) {
    console.error("payment email log error", claimError);
    return { sent: false, skipped: true, reason: "log_error" };
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    const message = "RESEND_API_KEY is not configured.";
    await supabase.from("program_order_emails").update({
      status: "failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    }).eq("order_id", order.id);
    console.error(message);
    return { sent: false, configured: false };
  }

  const from = Deno.env.get("PROGRAM_EMAIL_FROM") ?? "Coach Amit Soni <noreply@coachamitsoni.com>";
  const loginUrl = "https://learn.coachamitsoni.com/learn/login";
  const safeName = escapeHtml(name);
  const safeProgram = escapeHtml(programTitle);
  const amount = `${order.currency} ${Math.round(Number(order.amount_inr)).toLocaleString("en-IN")}`;
  const safeOrderId = escapeHtml(order.provider_order_id);
  const safePaymentId = escapeHtml(paymentId ?? order.provider_payment_id ?? "Not available");

  const html = `<!doctype html><html><body style="margin:0;background:#0b1120;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb"><div style="max-width:620px;margin:0 auto;padding:32px 16px"><div style="background:#111827;border:1px solid #243244;border-radius:18px;overflow:hidden"><div style="padding:28px 30px;background:linear-gradient(135deg,#0e7490,#4f46e5,#c2410c);color:#fff"><div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.9">Coach Amit Soni</div><h1 style="margin:10px 0 0;font-size:28px;line-height:1.2">Payment successful</h1><p style="margin:10px 0 0;font-size:15px;line-height:1.6;opacity:.92">Your program enrollment is confirmed.</p></div><div style="padding:30px"><p style="margin:0 0 18px;font-size:16px">Hi ${safeName},</p><p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#cbd5e1">Thank you for your purchase. Your payment has been verified and your access to the program below is now active.</p><div style="padding:18px;border:1px solid #334155;border-radius:14px;background:#0f172a"><div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Program</div><div style="margin-top:6px;font-size:19px;font-weight:700;color:#fff">${safeProgram}</div><div style="margin-top:16px;display:grid;gap:8px;font-size:13px;color:#cbd5e1"><div><strong style="color:#fff">Amount paid:</strong> ${escapeHtml(amount)}</div><div><strong style="color:#fff">Payment ID:</strong> ${safePaymentId}</div><div><strong style="color:#fff">Order ID:</strong> ${safeOrderId}</div></div></div><div style="text-align:center;margin:28px 0"><a href="${loginUrl}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#22d3ee;color:#082f49;text-decoration:none;font-weight:700">Student Login</a></div><p style="margin:0;font-size:13px;line-height:1.7;color:#94a3b8">If this is your first login, use <strong style="color:#cbd5e1">Forgot Password</strong> on the Student Login page to set your password.</p><p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:#94a3b8">If you did not make this purchase or need help, please contact Coach Amit Soni support.</p></div></div><p style="margin:18px 0 0;text-align:center;font-size:11px;color:#64748b">This is an automated payment and enrollment confirmation.</p></div></body></html>`;

  const text = `Hi ${name},\n\nYour payment for ${programTitle} has been verified and your program enrollment is confirmed.\n\nAmount paid: ${amount}\nPayment ID: ${paymentId ?? order.provider_payment_id ?? "Not available"}\nOrder ID: ${order.provider_order_id}\n\nStudent Login: ${loginUrl}\n\nIf this is your first login, use Forgot Password to set your password.\n\nThis is an automated payment and enrollment confirmation.`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
        "Idempotency-Key": `program-payment-confirmation/${order.id}`,
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `Payment successful — ${programTitle}`,
        html,
        text,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result?.message ?? result?.error ?? `Resend returned HTTP ${response.status}`;
      await supabase.from("program_order_emails").update({
        status: "failed",
        error_message: String(message),
        updated_at: new Date().toISOString(),
      }).eq("order_id", order.id);
      console.error("Resend payment confirmation error", message);
      return { sent: false, configured: true, error: String(message) };
    }

    await supabase.from("program_order_emails").update({
      status: "sent",
      provider_message_id: typeof result?.id === "string" ? result.id : null,
      error_message: null,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("order_id", order.id);

    return { sent: true, providerMessageId: result?.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected email delivery error.";
    await supabase.from("program_order_emails").update({
      status: "failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    }).eq("order_id", order.id);
    console.error("payment confirmation email error", error);
    return { sent: false, configured: true, error: message };
  }
}
