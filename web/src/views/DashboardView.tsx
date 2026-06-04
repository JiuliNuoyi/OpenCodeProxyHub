import { Boxes, Cable, Route, ServerCog, ShieldCheck, Workflow } from "lucide-react";
import type { ConsoleData } from "../hooks/useConsoleData";
import type { View } from "../types";

const flow = [
  { icon: Boxes, title: "客户端", sub: "Cursor、Cline、Claude Code" },
  { icon: ServerCog, title: "Fastify 网关", sub: "OpenAI + Anthropic 兼容" },
  { icon: Route, title: "前置代理", sub: "可选链式 7897" },
  { icon: Cable, title: "Zen 上游", sub: "opencode.ai" },
];

export function DashboardView({ data, onSelect }: { data: ConsoleData; onSelect: (view: View) => void }) {
  const { apiKeys, models } = data;
  const enabledModels = models.filter((m) => m.enabled).length;
  const enabledKeys = apiKeys.filter((k) => k.enabled).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="card bg-base-100 shadow-sm lg:col-span-2">
        <div className="card-body">
          <h2 className="card-title text-base">网关拓扑</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {flow.map((node, idx) => {
              const Icon = node.icon;
              return (
                <div className="flex items-center gap-3" key={node.title}>
                  <div className="flex w-32 flex-col items-center gap-1 rounded-xl border border-base-300 bg-base-200/50 p-3 text-center">
                    <Icon size={22} className="text-primary" />
                    <span className="text-sm font-medium">{node.title}</span>
                    <span className="text-[11px] leading-tight text-base-content/50">{node.sub}</span>
                  </div>
                  {idx < flow.length - 1 && <Workflow size={16} className="text-base-content/30" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title text-base">
              <ShieldCheck size={18} className="text-primary" /> 摘要
            </h2>
            <button className="btn btn-ghost btn-xs" onClick={() => onSelect("keys")}>
              管理
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="oph-inset p-3">
              <div className="text-xs text-base-content/50">API Key</div>
              <div className="text-xl font-bold">
                {enabledKeys}
                <span className="text-sm font-normal text-base-content/40">/{apiKeys.length}</span>
              </div>
            </div>
            <div className="oph-inset p-3">
              <div className="text-xs text-base-content/50">启用模型</div>
              <div className="text-xl font-bold">
                {enabledModels}
                <span className="text-sm font-normal text-base-content/40">/{models.length}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {apiKeys.slice(0, 4).map((key) => (
              <div key={key.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{key.name}</span>
                <span className={`badge badge-sm ${key.enabled ? "badge-success" : "badge-ghost"}`}>{key.enabled ? "启用" : "禁用"}</span>
              </div>
            ))}
            {apiKeys.length === 0 && <p className="text-sm text-base-content/40">暂无 API Key</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
