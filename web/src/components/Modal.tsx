import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, icon, onClose, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            {icon}
            {title}
          </h3>
          <button className="btn btn-ghost btn-xs btn-circle" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">{children}</div>
        {footer && <div className="modal-action">{footer}</div>}
      </div>
      <div className="modal-backdrop bg-black/40" onClick={onClose} />
    </div>
  );
}
