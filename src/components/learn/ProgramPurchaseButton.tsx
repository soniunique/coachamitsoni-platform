import { useEffect, useState } from "react";
import { CheckCircle2, IndianRupee, Loader2, ShieldCheck } from "lucide-react";
import { LearnModal } from "@/components/learn/LearnModal";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type OrderResponse = {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
  program_id: string;
  program_title: string;
};

type VerifyResponse = {
  success: boolean;
  enrolled: boolean;
  account_created?: boolean;
};

let razorpayLoader: Promise<void> | null = null;

function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Checkout is only available in a browser."));
  if (window.Razorpay) return Promise.resolve();
  if (razorpayLoader) return razorpayLoader;
  razorpayLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load secure payment checkout.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load secure payment checkout."));
    document.head.appendChild(script);
  }).catch((error) => {
    razorpayLoader = null;
    throw error;
  });
  return razorpayLoader;
}

export function ProgramPurchaseButton({ programId, programTitle, priceInr }: { programId: string; programTitle: string; priceInr: number }) {
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!open) {
      setProcessing(false);
      setError("");
      setSuccess(false);
      setAccountCreated(false);
      return;
    }
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(current => current || user.email || "");
      // Never prefill or suggest the site owner's name. The purchaser enters their own full name.
    });
  }, [open]);

  async function startPayment() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();
    if (!/^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(normalizedEmail)) {
      setError("Enter a valid email address. Your LMS access details will be linked to this email.");
      return;
    }
    if (normalizedName.length < 2) {
      setError("Enter your full name.");
      return;
    }

    setProcessing(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error: orderError } = await supabase.functions.invoke("create-program-payment-order", {
        body: { program_id: programId, email: normalizedEmail, full_name: normalizedName, authenticated_user_id: user?.id ?? null },
      });
      if (orderError) throw new Error(orderError.message || "Unable to start checkout.");
      const order = data as OrderResponse | null;
      if (!order?.order_id || !order.key_id || !order.amount) throw new Error("The payment order could not be created.");

      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Secure payment checkout is unavailable right now.");

      const razorpay = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Coach Amit Soni",
        description: order.program_title,
        order_id: order.order_id,
        prefill: { name: normalizedName, email: normalizedEmail },
        theme: { color: "#22d3ee" },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          setProcessing(true);
          setError("");
          try {
            const { data: verification, error: verificationError } = await supabase.functions.invoke("verify-program-payment", {
              body: {
                program_id: programId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            if (verificationError) throw new Error(verificationError.message || "Payment verification failed.");
            const result = verification as VerifyResponse | null;
            if (!result?.success || !result.enrolled) throw new Error("Payment was received, but enrollment could not be confirmed. Please contact support before trying again.");
            setAccountCreated(Boolean(result.account_created));
            setSuccess(true);
          } catch (verificationError) {
            setError(verificationError instanceof Error ? verificationError.message : "Payment verification failed.");
          } finally {
            setProcessing(false);
          }
        },
        modal: { ondismiss: () => setProcessing(false) },
      });

      // Keep the reusable site modal mounted while Razorpay opens its checkout layer.
      // This prevents the page from flashing/reflowing between two modal states.
      window.setTimeout(() => razorpay.open(), 0);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Unable to start payment.");
      setProcessing(false);
    }
  }

  return <>
    <button type="button" className="learn-primary-button mt-5 w-full" onClick={() => setOpen(true)}>
      <IndianRupee size={15} /> Buy program · ₹{Math.round(priceInr).toLocaleString("en-IN")}
    </button>
    <LearnModal
      open={open}
      onClose={() => { if (!processing) setOpen(false); }}
      title={success ? "Program unlocked" : processing ? "Opening secure checkout" : `Purchase ${programTitle}`}
      description={success ? "Your payment has been verified and program access is now active." : processing ? "Please complete your payment in the secure Razorpay window." : "Enter your details, then complete the secure Razorpay checkout."}
      context={programTitle}
      contextLabel="Program"
      maxWidth="max-w-2xl"
      footer={success ? <button type="button" className="learn-primary-button" onClick={() => window.location.assign("/learn/login")}>Student Login</button> : <><button type="button" className="learn-secondary-button" onClick={() => setOpen(false)} disabled={processing}>Cancel</button><button type="button" className="learn-primary-button" onClick={() => void startPayment()} disabled={processing}>{processing ? <><Loader2 size={16} className="animate-spin" /> Opening checkout…</> : <><IndianRupee size={16} /> Pay ₹{Math.round(priceInr).toLocaleString("en-IN")}</>}</button></>}
    >
      {success ? <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5"><div className="flex items-center gap-3 text-emerald-300"><CheckCircle2 size={22} /><span className="font-semibold">Payment verified successfully</span></div><p className="mt-3 text-sm leading-6 text-slate-400">You now have access to all published courses inside {programTitle}.</p>{accountCreated&&<p className="mt-3 text-sm leading-6 text-slate-300">An LMS account has been created for <strong className="text-white">{email}</strong>. Use Student Login and choose Forgot Password to set your password.</p>}</div> : <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Full name</span><input value={fullName} onChange={e=>setFullName(e.target.value)} className="learn-input w-full" placeholder="Enter your full name" autoComplete="name" disabled={processing}/></label><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="learn-input w-full" placeholder="you@example.com" autoComplete="email" disabled={processing}/></label></div><div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"><span className="text-sm text-slate-400">Program access</span><span className="font-bold text-white">₹{Math.round(priceInr).toLocaleString("en-IN")}</span></div><div className="flex gap-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4 text-xs leading-5 text-slate-400"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-cyan-300" /><span>Payment is processed securely by Razorpay. Your enrollment is granted only after the server verifies the payment.</span></div>{error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-300">{error}</div>}</div>}
    </LearnModal>
  </>;
}
