import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { Spinner } from "./icons";

/**
 * Confirmation dialog. Accessible out of the box (focus trap, Escape, click
 * outside) via Headless UI; styled to match the rest of the app. `children`
 * (e.g. a control for how much to change) go under the description. Focus
 * starts on Cancel, so nothing happens on a stray Enter.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  icon = null,
  children = null,
}) {
  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-ink-950/70 backdrop-blur-sm transition duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
        <DialogPanel
          transition
          className="card w-full max-w-md bg-ink-850 p-6 transition duration-200 ease-out data-closed:translate-y-4 data-closed:opacity-0 sm:data-closed:translate-y-0 sm:data-closed:scale-95"
        >
          <div className="flex items-start gap-4">
            {icon && (
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  danger ? "bg-red-500/15 text-red-300" : "bg-accent-400/15 text-accent-300"
                }`}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-display text-lg font-bold text-ink-50">{title}</DialogTitle>
              {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{description}</p>}
              {children}
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} data-autofocus>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy && <Spinner size={16} />}
              {confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
