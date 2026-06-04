import { Activity, KeyRound, Network, ShieldCheck } from "lucide-react";

export interface StatItem {
  label: string;
  value: string;
  detail: string;
  tone: "primary" | "success" | "warning" | "info";
  icon: "shield" | "key" | "net" | "activity";
}

const iconMap = { shield: ShieldCheck, key: KeyRound, net: Network, activity: Activity };
const toneText: Record<StatItem["tone"], string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
};

export function StatCards({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        return (
          <div key={item.label} className="card bg-base-100 shadow-sm">
            <div className="card-body gap-1 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-base-content/50">{item.label}</span>
                <Icon size={18} className={toneText[item.tone]} />
              </div>
              <strong className="text-2xl font-bold leading-tight">{item.value}</strong>
              <small className="text-xs text-base-content/50">{item.detail}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}
