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

  useEffect(() => {
    if (!open) {
      setProcessing(false);
      setError("");
      setSuccess(false);
    }
  }, [open]);

  async function startPayment() {
    setProcessing(true);
    setError("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please sign in before purchasing a program.");

      const { data, error: orderError } = await supabase.functions.invoke("create-program-payment-order", {
        body: { program_id: programId },
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
        prefill: { email: user.email ?? "" },
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
            setSuccess(true);
          } catch (verificationError) {
            setError(verificationError instanceof Error ? verificationError.message : "Payment verification failed.");
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => setProcessing(false),
        },
      });
      razorpay.open();
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
      title={success ? "Program unlocked" : `Purchase ${programTitle}`}
      description={success ? "Your payment has been verified and program access is now active." : "Complete the secure Razorpay checkout to unlock every course in this program."}
      context={programTitle}
      footer={success ? <button type="button" className="learn-primary-button" onClick={() => window.location.assign("/learn/my-learning")}>Go to My Learning</button> : <><button type="button" className="learn-secondary-button" onClick={() => setOpen(false)} disabled={processing}>Cancel</button><button type="button" className="learn-primary-button" onClick={() => void startPayment()} disabled={processing}>{processing ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><IndianRupee size={16} /> Pay ₹{Math.round(priceInr).toLocaleString("en-IN")}</>}</button></>}
    >
      {success ? <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5"><div className="flex items-center gap-3 text-emerald-300"><CheckCircle2 size={22} /><span className="font-semibold">Payment verified successfully</span></div><p className="mt-3 text-sm leading-6 text-slate-400">You now have access to all published courses inside {programTitle}.</p></div> : <div className="space-y-4"><div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"><span className="text-sm text-slate-400">Program access</span><span className="font-bold text-white">₹{Math.round(priceInr).toLocaleString("en-IN")}</span></div><div className="flex gap-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4 text-xs leading-5 text-slate-400"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-cyan-300" /><span>Payment is processed securely by Razorpay. Your enrollment is granted only after the server verifies the payment.</span></div>{error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-300">{error}</div>}</div>}
    </LearnModal>
  </>;
}
