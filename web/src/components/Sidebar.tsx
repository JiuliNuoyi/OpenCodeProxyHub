import { Activity, BarChart3, Gauge, KeyRound, Network, Radar, SlidersHorizontal } from "lucide-react";
import type { View } from "../types";

const navItems: Array<{ view: View; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { view: "dashboard", label: "总览", icon: Gauge },
  { view: "keys", label: "API Keys", icon: KeyRound },
  { view: "models", label: "模型", icon: Activity },
  { view: "settings", label: "设置", icon: SlidersHorizontal },
  { view: "proxy", label: "代理池", icon: Network },
  { view: "monitor", label: "监控", icon: BarChart3 },
];

export function Sidebar({ view, onSelect }: { view: View; onSelect: (view: View) => void }) {
  return (
    <aside className="flex w-16 flex-col items-center gap-2 border-r border-base-300 bg-base-100 py-4 md:w-60 md:items-stretch md:px-4">
      <div className="mb-4 flex items-center gap-3 px-1 md:px-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-content">
          <Radar size={22} />
        </div>
        <div className="hidden flex-col md:flex">
          <strong className="text-sm font-semibold leading-tight">OpenCodeProxyHub</strong>
          <span className="text-xs text-base-content/50">Control Plane</span>
        </div>
      </div>
      <nav className="flex flex-col gap-1" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = view === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onSelect(item.view)}
              title={item.label}
              className={`flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:justify-start ${
                active ? "bg-primary text-primary-content shadow-sm" : "text-base-content/70 hover:bg-base-200"
              }`}
            >
              <Icon size={19} />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
