import { BarChart3 } from "lucide-react";
import type { ConsoleData } from "../hooks/useConsoleData";

export function MonitorView({ data }: { data: ConsoleData }) {
  const { metricsData, runtime } = data;

  if (!metricsData) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body items-center text-center">
          <BarChart3 size={34} className="text-base-content/30" />
          <h3 className="font-semibold">指标加载中…</h3>
          <p className="text-sm text-base-content/50">输入控制台密码后可查看 HTTP、上游、限流器与运行时指标。</p>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "HTTP 请求", value: metricsData.http.totalRequests, sub: `错误 ${metricsData.http.errorRequests} · P95 ${metricsData.http.latencyMs.p95}ms` },
    { label: "上游请求", value: metricsData.upstream.totalRequests, sub: `错误 ${metricsData.upstream.errorRequests} · P95 ${metricsData.upstream.latencyMs.p95}ms` },
    { label: "运行状态", value: runtime?.runtime.draining ? "排水中" : "运行中", sub: `进行中 ${runtime?.runtime.inFlightRequests ?? 0} · ${runtime?.limiter.backend || "limiter"}` },
    { label: "运行时长", value: `${Math.floor(metricsData.uptimeSeconds / 60)}m`, sub: metricsData.startedAt },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card bg-base-100 shadow-sm">
            <div className="card-body gap-1 p-4">
              <span className="text-xs text-base-content/50">{s.label}</span>
              <strong className="truncate text-2xl font-bold">{s.value}</strong>
              <small className="truncate text-xs text-base-content/40">{s.sub}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KvCard title="HTTP 状态码" entries={Object.entries(metricsData.http.byStatus)} />
        <KvCard title="路由热度" entries={Object.entries(metricsData.http.byRoute)} />
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-2 p-4">
            <h3 className="text-sm font-semibold">最近错误</h3>
            {metricsData.recentErrors.length === 0 && <p className="text-sm text-base-content/40">暂无错误</p>}
            {metricsData.recentErrors.map((item) => (
              <div key={`${item.at}-${item.message}`} className="rounded-lg bg-error/10 p-2 text-xs">
                <div className="font-medium text-error">{item.scope} · {item.statusCode || "ERR"}</div>
                <div className="text-base-content/60">{item.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KvCard({ title, entries }: { title: string; entries: Array<[string, number]> }) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-1 p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {entries.length === 0 && <p className="text-sm text-base-content/40">暂无数据</p>}
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className="truncate text-base-content/60">{k}</span>
            <strong className="tabular-nums">{v}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
