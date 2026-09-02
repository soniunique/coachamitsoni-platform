import { useEffect } from "react";
import { X } from "lucide-react";

export function LearnModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="learn-modal-root" role="presentation">
      <button type="button" className="learn-modal-backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className={`learn-modal-panel ${maxWidth}`} role="dialog" aria-modal="true" aria-labelledby="learn-modal-title">
        <div className="learn-modal-header">
          <div className="min-w-0">
            <div className="learn-eyebrow">Learning Hub</div>
            <h2 id="learn-modal-title" className="mt-1 text-xl font-bold tracking-tight">{title}</h2>
            {description && <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="learn-modal-close" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="learn-modal-body">{children}</div>
        {footer && <div className="learn-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
