import { CheckCircle2, Info, XCircle } from "lucide-react";
import type { ToastMessage } from "../hooks/useConsoleData";

const toneClass: Record<ToastMessage["tone"], string> = {
  success: "alert-success",
  error: "alert-error",
  info: "alert-info",
};

const toneIcon = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function Toasts({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="toast toast-top toast-end z-50">
      {toasts.map((toast) => {
        const Icon = toneIcon[toast.tone];
        return (
          <div key={toast.id} className={`alert ${toneClass[toast.tone]} shadow-lg`} onClick={() => onDismiss(toast.id)} role="status">
            <Icon size={18} />
            <span className="text-sm">{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
}
