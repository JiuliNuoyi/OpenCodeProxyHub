import type { ReactNode } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import type { View } from "../types";
import { Sidebar } from "./Sidebar";

const viewTitles: Record<View, string> = {
  dashboard: "总览",
  keys: "API Key 管理",
  models: "模型开放面",
  settings: "系统设置",
  proxy: "出口代理池",
  monitor: "运行监控",
};

interface LayoutProps {
  view: View;
  onSelect: (view: View) => void;
  busy: boolean;
  statusText: string;
  authModeLabel: string;
  onRefresh: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function Layout({ view, onSelect, busy, statusText, authModeLabel, onRefresh, onLogout, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-base-200">
      <Sidebar view={view} onSelect={onSelect} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-base-300 bg-base-100 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{viewTitles[view]}</h1>
            <p className="truncate text-xs text-base-content/50">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-success align-middle" />
              {busy ? "处理中…" : statusText}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-ghost hidden md:inline-flex">{authModeLabel}</span>
            <button className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={busy} title="刷新数据">
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
              <span className="hidden sm:inline">刷新</span>
            </button>
            <button className="btn btn-outline btn-sm" onClick={onLogout} disabled={busy}>
              <LogOut size={16} />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </header>
        <main className="oph-scroll flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
