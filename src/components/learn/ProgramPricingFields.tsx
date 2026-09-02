import { IndianRupee, ShieldCheck } from "lucide-react";

export function ProgramPricingFields({
  paymentEnabled,
  priceInr,
  onPaymentEnabledChange,
  onPriceChange,
}: {
  paymentEnabled: boolean;
  priceInr: number;
  onPaymentEnabledChange: (value: boolean) => void;
  onPriceChange: (value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-cyan-400/10 p-2 text-cyan-300"><IndianRupee size={16} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Program payment</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">Students will purchase the program as one package and receive access to every course inside it.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={paymentEnabled} onChange={e => onPaymentEnabledChange(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
              <span className="font-medium">Enable paid enrollment</span>
            </label>
          </div>
          {paymentEnabled && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Program price (₹)</label>
                <input type="number" min="1" step="1" value={priceInr || ""} onChange={e => onPriceChange(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60" placeholder="4999" />
              </div>
              <div className="flex items-end">
                <div className="flex w-full gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3 text-xs leading-5 text-slate-400">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                  <span>Payment access will be granted only after secure server-side payment verification.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
