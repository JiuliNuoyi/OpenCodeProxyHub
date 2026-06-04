import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmText = "确认", danger = true, busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle size={20} className={danger ? "text-error" : "text-warning"} />
          {title}
        </h3>
        <p className="py-4 text-sm text-base-content/70">{message}</p>
        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button className={`btn btn-sm ${danger ? "btn-error" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
            {confirmText}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/40" onClick={onCancel} />
    </div>
  );
}
