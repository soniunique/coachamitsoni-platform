import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function LearnModal({
  open,
  onClose,
  title,
  description,
  context,
  contextLabel = "Course",
  children,
  footer,
  maxWidth = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  context?: string;
  contextLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  // Keep the latest close handler available without making the modal lifecycle
  // effect re-run every time the parent re-renders (for example, on each keystroke).
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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
            {context && (
              <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[.07] px-3 py-2 text-xs">
                <span className="font-bold uppercase tracking-[.14em] text-cyan-300">{contextLabel}</span>
                <span className="truncate font-semibold text-slate-100">{context}</span>
              </div>
            )}
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
