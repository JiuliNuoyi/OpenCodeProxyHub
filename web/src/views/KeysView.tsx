import { useMemo, useState } from "react";
import { Copy, KeyRound, Pencil, Plus, ShieldCheck, SlidersHorizontal, Trash2 } from "lucide-react";
import type { ConsoleData } from "../hooks/useConsoleData";
import type { ApiKeyItem, ApiKeyPolicy } from "../types";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";

export function KeysView({ data }: { data: ConsoleData }) {
  const { apiKeys, busy, lastCreatedKey, createKey, toggleKey, deleteKey, updateKeyMeta, updateKeyPolicy, copyCreatedKey, copyStoredKey } = data;
  const [newName, setNewName] = useState("默认用户");
  const [search, setSearch] = useState("");
  const [metaTarget, setMetaTarget] = useState<ApiKeyItem | null>(null);
  const [policyTarget, setPolicyTarget] = useState<ApiKeyItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyItem | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return apiKeys;
    return apiKeys.filter((k) => [k.name, k.keyPrefix, k.description || "", ...k.labels].join(" ").toLowerCase().includes(q));
  }, [apiKeys, search]);

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <input className="input input-bordered input-sm w-44" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新 Key 名称" />
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => createKey(newName)}>
              <Plus size={16} /> 创建 Key
            </button>
            <input className="input input-bordered input-sm ml-auto w-64" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索名称、前缀、备注或标签" />
          </div>

          {lastCreatedKey && (
            <div className="alert alert-success">
              <KeyRound size={18} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold">新建 Key 明文（仅显示一次）</div>
                <code className="block truncate text-sm">{lastCreatedKey}</code>
              </div>
              <button className="btn btn-sm" onClick={() => copyCreatedKey()}>
                <Copy size={14} /> 复制
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((key) => (
          <div key={key.id} className={`card bg-base-100 shadow-sm ${key.enabled ? "" : "opacity-60"}`}>
            <div className="card-body gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <strong className="truncate">{key.name}</strong>
                    <span className={`badge badge-sm ${key.enabled ? "badge-success" : "badge-ghost"}`}>{key.enabled ? "启用" : "禁用"}</span>
                  </div>
                  <code className="text-xs text-base-content/50">{key.keyPrefix}</code>
                </div>
                <ShieldCheck size={18} className="shrink-0 text-base-content/30" />
              </div>

              <p className="text-xs text-base-content/60">{key.description || "无备注"}</p>
              {key.labels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {key.labels.map((label) => (
                    <span key={label} className="badge badge-outline badge-sm">
                      #{label}
                    </span>
                  ))}
                </div>
              )}

              <div className="oph-inset grid grid-cols-3 gap-2 p-2 text-center text-xs">
                <div>
                  <div className="text-base-content/50">请求</div>
                  <div className="font-semibold tabular-nums">{key.requestCount}</div>
                </div>
                <div>
                  <div className="text-base-content/50">RPM</div>
                  <div className="font-semibold tabular-nums">{key.policy.requestsPerMinute ?? "默认"}</div>
                </div>
                <div>
                  <div className="text-base-content/50">客户端</div>
                  <div className="font-semibold tabular-nums">{key.recentClients.length}</div>
                </div>
              </div>

              <div className="text-[11px] text-base-content/40">最近使用：{key.lastUsedAt || "从未使用"}</div>

              <div className="flex flex-wrap gap-1">
                <button className="btn btn-ghost btn-xs" disabled={busy || !key.hasRecoverableKey} onClick={() => copyStoredKey(key)} title={key.hasRecoverableKey ? "复制明文" : "该 Key 未保存明文"}>
                  <Copy size={13} /> 复制
                </button>
                <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => setMetaTarget(key)}>
                  <Pencil size={13} /> 备注
                </button>
                <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => setPolicyTarget(key)}>
                  <SlidersHorizontal size={13} /> 策略
                </button>
                <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => toggleKey(key)}>
                  {key.enabled ? "禁用" : "启用"}
                </button>
                <button className="btn btn-ghost btn-xs text-error" disabled={busy} onClick={() => setDeleteTarget(key)}>
                  <Trash2 size={13} /> 删除
                </button>
              </div>
            </div>
          </div>
        ))}
        {visible.length === 0 && <p className="text-sm text-base-content/40">没有匹配的 API Key</p>}
      </div>

      {metaTarget && <MetaModal target={metaTarget} busy={busy} onClose={() => setMetaTarget(null)} onSave={(desc, labels) => { updateKeyMeta(metaTarget, desc, labels); setMetaTarget(null); }} />}
      {policyTarget && <PolicyModal target={policyTarget} busy={busy} onClose={() => setPolicyTarget(null)} onSave={(policy) => { updateKeyPolicy(policyTarget, policy); setPolicyTarget(null); }} />}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除 API Key"
        message={`确定删除 API key「${deleteTarget?.name}」吗？此操作不可撤销。`}
        confirmText="删除"
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteKey(deleteTarget); setDeleteTarget(null); }}
      />
    </div>
  );
}

function MetaModal({ target, busy, onClose, onSave }: { target: ApiKeyItem; busy: boolean; onClose: () => void; onSave: (desc: string, labels: string[]) => void }) {
  const [desc, setDesc] = useState(target.description || "");
  const [labels, setLabels] = useState(target.labels.join(", "));
  return (
    <Modal open title={`编辑「${target.name}」`} icon={<Pencil size={18} className="text-primary" />} onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>取消</button>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onSave(desc, labels.split(",").map((l) => l.trim()).filter(Boolean))}>保存</button>
        </>
      }
    >
      <label className="form-control">
        <span className="label-text mb-1 text-sm">备注</span>
        <input className="input input-bordered" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="用途说明" />
      </label>
      <label className="form-control">
        <span className="label-text mb-1 text-sm">标签（逗号分隔）</span>
        <input className="input input-bordered" value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="prod, team-a" />
      </label>
    </Modal>
  );
}

function PolicyModal({ target, busy, onClose, onSave }: { target: ApiKeyItem; busy: boolean; onClose: () => void; onSave: (policy: ApiKeyPolicy) => void }) {
  const p = target.policy;
  const [rpm, setRpm] = useState(p.requestsPerMinute?.toString() ?? "");
  const [maxReq, setMaxReq] = useState(p.maxConcurrentRequests?.toString() ?? "");
  const [maxStream, setMaxStream] = useState(p.maxConcurrentStreams?.toString() ?? "");
  const [models, setModels] = useState((p.allowedModels || []).join(", "));
  const [allowProxy, setAllowProxy] = useState(p.allowProxy ?? false);

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const submit = () => {
    const policy: ApiKeyPolicy = {
      requestsPerMinute: num(rpm),
      maxConcurrentRequests: num(maxReq),
      maxConcurrentStreams: num(maxStream),
      allowedModels: models.split(",").map((m) => m.trim()).filter(Boolean),
      allowProxy,
    };
    if (!policy.allowedModels?.length) delete policy.allowedModels;
    onSave(policy);
  };

  return (
    <Modal open title={`策略「${target.name}」`} icon={<SlidersHorizontal size={18} className="text-primary" />} onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>取消</button>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={submit}>保存策略</button>
        </>
      }
    >
      <p className="text-xs text-base-content/50">留空字段继承全局默认值。</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="form-control">
          <span className="label-text mb-1 text-xs">每分钟请求</span>
          <input className="input input-bordered input-sm" type="number" value={rpm} onChange={(e) => setRpm(e.target.value)} placeholder="默认" />
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">并发请求</span>
          <input className="input input-bordered input-sm" type="number" value={maxReq} onChange={(e) => setMaxReq(e.target.value)} placeholder="默认" />
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">并发流</span>
          <input className="input input-bordered input-sm" type="number" value={maxStream} onChange={(e) => setMaxStream(e.target.value)} placeholder="默认" />
        </label>
      </div>
      <label className="form-control">
        <span className="label-text mb-1 text-sm">允许模型（逗号分隔，空=全部）</span>
        <input className="input input-bordered" value={models} onChange={(e) => setModels(e.target.value)} placeholder="deepseek-v4-flash-free, ..." />
      </label>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={allowProxy} onChange={(e) => setAllowProxy(e.target.checked)} />
        <span className="text-sm">允许使用出口代理</span>
      </label>
    </Modal>
  );
}
