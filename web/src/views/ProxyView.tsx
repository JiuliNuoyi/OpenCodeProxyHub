import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Network, Plus, Route, Waypoints } from "lucide-react";
import type { ConsoleData } from "../hooks/useConsoleData";
import type { ProxyDraft, ProxyNode } from "../types";
import { MeterBar } from "../components/MeterBar";
import { ResultStrip } from "../components/ResultStrip";
import { ConfirmDialog } from "../components/ConfirmDialog";

const stateBadge = (proxy: ProxyNode): { label: string; cls: string } => {
  if (!proxy.enabled) return { label: "已禁用", cls: "badge-ghost" };
  if (proxy.consecutiveRateLimitCount >= 3) return { label: "429 风险", cls: "badge-warning" };
  if (proxy.cooldownUntil && Date.parse(proxy.cooldownUntil) > Date.now()) return { label: "冷却中", cls: "badge-info" };
  if (proxy.lastError) return { label: "异常", cls: "badge-error" };
  return { label: "健康", cls: "badge-success" };
};

export function ProxyView({ data }: { data: ConsoleData }) {
  const { proxies, settings, busy, createProxy, toggleProxy, testProxy, deleteProxy, updateSettings } = data;
  const [draft, setDraft] = useState<ProxyDraft>({ name: "香港节点 1", type: "http", url: "", dailyRequestLimit: 1000, maxConcurrency: 10 });
  const [deleteTarget, setDeleteTarget] = useState<ProxyNode | null>(null);

  const preProxyEnabled = Boolean(settings?.outboundPreProxyEnabled);
  const [preProxyDraft, setPreProxyDraft] = useState("");
  // Keep the address draft in sync with the persisted value when settings (re)load.
  useEffect(() => { setPreProxyDraft(settings?.outboundPreProxyUrl ?? ""); }, [settings?.outboundPreProxyUrl]);
  const preProxyDirty = preProxyDraft.trim() !== (settings?.outboundPreProxyUrl ?? "");

  const prioritized = useMemo(() => {
    const now = Date.now();
    return [...proxies]
      .filter((p) => p.enabled)
      .filter((p) => !p.cooldownUntil || Date.parse(p.cooldownUntil) <= now)
      .filter((p) => p.dailyRequestLimit === 0 || p.dailyRequestCount < p.dailyRequestLimit)
      .filter((p) => p.currentConcurrency < p.maxConcurrency)
      .sort((a, b) => b.weight - a.weight)[0] || null;
  }, [proxies]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <InfoCard icon={<Route size={16} className="text-primary" />} title="当前策略" value="优先填充" sub="高权重节点优先，同权重按顺序" />
        <InfoCard icon={<AlertTriangle size={16} className="text-warning" />} title="429 熔断" value="连续 5 次" sub="触发后自动禁用，需手动开启" />
        <InfoCard icon={<CheckCircle2 size={16} className="text-success" />} title="优先节点" value={prioritized?.name || "无可用"} sub="按权重与可用性选出" />
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <div className="flex items-center gap-2">
            <Waypoints size={16} className="text-primary" />
            <h2 className="card-title text-base">出站前置代理（链式代理）</h2>
          </div>
          <p className="text-xs text-base-content/50">开启后，所有代理节点的出站连接会先经此本机地址再连上游，用于代理节点无法直连、需先走本机代理出网的网络。修改后对下一个请求即时生效，无需重启。</p>

          <label className="oph-inset flex cursor-pointer items-start gap-2 p-2">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm mt-0.5"
              disabled={busy || !settings}
              checked={preProxyEnabled}
              onChange={() => updateSettings({ outboundPreProxyEnabled: !preProxyEnabled })}
            />
            <span className="text-xs">
              <strong className="block">前置代理</strong>
              <span className="text-base-content/50">{preProxyEnabled ? "已开启，节点经前置代理出网" : "已关闭，节点直连上游"}</span>
            </span>
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <label className="form-control min-w-64 flex-1">
              <span className="label-text mb-1 text-xs">前置代理地址（http/https）</span>
              <input
                className="input input-bordered input-sm"
                value={preProxyDraft}
                disabled={busy || !settings}
                onChange={(e) => setPreProxyDraft(e.target.value)}
                placeholder="http://127.0.0.1:7897"
              />
            </label>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || !settings || !preProxyDirty}
              onClick={() => updateSettings({ outboundPreProxyUrl: preProxyDraft.trim() })}
            >
              保存
            </button>
          </div>
          {!(settings?.outboundPreProxyUrl || "").trim() && <p className="text-xs text-warning/80">请先填写并保存地址，再开启前置代理（直接开启会因地址为空而报错）。</p>}
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">新增代理节点</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="form-control w-36">
              <span className="label-text mb-1 text-xs">名称</span>
              <input className="input input-bordered input-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="代理名称" />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 text-xs">类型</span>
              <select className="select select-bordered select-sm" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </label>
            <label className="form-control min-w-64 flex-1">
              <span className="label-text mb-1 text-xs">代理 URL</span>
              <input className="input input-bordered input-sm" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="http://user:pass@1.2.3.4:8080" />
            </label>
            <label className="form-control w-32">
              <span className="label-text mb-1 text-xs">每日上限（0=不限）</span>
              <input className="input input-bordered input-sm" type="number" min={0} value={draft.dailyRequestLimit} onChange={(e) => setDraft({ ...draft, dailyRequestLimit: Number(e.target.value) })} placeholder="每日请求上限" />
            </label>
            <label className="form-control w-24">
              <span className="label-text mb-1 text-xs">最大并发</span>
              <input className="input input-bordered input-sm" type="number" min={1} value={draft.maxConcurrency} onChange={(e) => setDraft({ ...draft, maxConcurrency: Number(e.target.value) })} placeholder="并发数" />
            </label>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => createProxy(draft)}>
              <Plus size={16} /> 新增
            </button>
          </div>
        </div>
      </div>

      {proxies.length === 0 && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body items-center text-center">
            <Network size={34} className="text-base-content/30" />
            <h3 className="font-semibold">尚未配置出口节点</h3>
            <p className="max-w-md text-sm text-base-content/50">添加 HTTP、HTTPS 或 SOCKS5 代理后，网关会优先填充第一个可用节点，连续 5 次 429 会自动禁用该节点。</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {proxies.map((proxy) => {
          const badge = stateBadge(proxy);
          const isPrimary = prioritized?.id === proxy.id;
          return (
            <div key={proxy.id} className={`card bg-base-100 shadow-sm ${isPrimary ? "ring-2 ring-primary/40" : ""}`}>
              <div className="card-body gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="truncate">{proxy.name}</strong>
                      <span className="badge badge-outline badge-sm">{proxy.type.toUpperCase()}</span>
                    </div>
                    <p className="truncate text-xs text-base-content/50">{proxy.url}</p>
                  </div>
                  <span className={`badge badge-sm shrink-0 ${isPrimary ? "badge-primary" : badge.cls}`}>{isPrimary ? "当前优先" : badge.label}</span>
                </div>

                <MeterBar label="今日用量" current={proxy.dailyRequestCount} max={proxy.dailyRequestLimit} />
                <MeterBar label="并发" current={proxy.currentConcurrency} max={proxy.maxConcurrency} />
                <MeterBar label="连续 429" current={proxy.consecutiveRateLimitCount || 0} max={5} unlimitedText="5" />

                {(() => {
                  const total = proxy.successCount + proxy.failCount;
                  const rate = total === 0 ? "—" : `${Math.round((proxy.successCount / total) * 100)}%`;
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-base-content/50">成功率 <span className="font-medium tabular-nums text-base-content/80">{rate}</span></span>
                        <span className="tabular-nums text-base-content/50">总 {total} · 成 {proxy.successCount} · 败 {proxy.failCount}</span>
                      </div>
                      <ResultStrip results={proxy.recentResults || []} />
                    </div>
                  );
                })()}

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div><div className="text-base-content/50">成功</div><div className="font-semibold tabular-nums text-success">{proxy.successCount}</div></div>
                  <div><div className="text-base-content/50">失败</div><div className="font-semibold tabular-nums text-error">{proxy.failCount}</div></div>
                  <div><div className="text-base-content/50">权重</div><div className="font-semibold tabular-nums">{proxy.weight}</div></div>
                </div>

                {proxy.lastError && <p className="truncate text-xs text-error">最后错误：{proxy.lastError}</p>}

                <div className="flex flex-wrap gap-1">
                  <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => toggleProxy(proxy)}>{proxy.enabled ? "禁用" : "启用"}</button>
                  <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => testProxy(proxy)}>测试</button>
                  <button className="btn btn-ghost btn-xs text-error" disabled={busy} onClick={() => setDeleteTarget(proxy)}>删除</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除代理节点"
        message={`确定删除代理「${deleteTarget?.name}」吗？`}
        confirmText="删除"
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteProxy(deleteTarget); setDeleteTarget(null); }}
      />
    </div>
  );
}

function InfoCard({ icon, title, value, sub }: { icon: React.ReactNode; title: string; value: string; sub: string }) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-1 p-4">
        <div className="flex items-center gap-2 text-xs text-base-content/50">{icon} {title}</div>
        <strong className="truncate text-lg">{value}</strong>
        <small className="text-xs text-base-content/40">{sub}</small>
      </div>
    </div>
  );
}
