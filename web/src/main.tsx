import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, AlertTriangle, BarChart3, Boxes, Cable, CheckCircle2, Gauge, KeyRound, LockKeyhole, Network, Radar, Route, ServerCog, ShieldCheck, SlidersHorizontal, TerminalSquare, Workflow, Zap } from "lucide-react";
import "./styles.css";

type View = "dashboard" | "keys" | "models" | "settings" | "proxy" | "monitor";
type AuthMode = "password";

const navItems: Array<{ view: View; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { view: "dashboard", label: "总览", icon: Gauge },
  { view: "keys", label: "API Keys", icon: KeyRound },
  { view: "models", label: "模型", icon: Activity },
  { view: "settings", label: "设置", icon: SlidersHorizontal },
  { view: "proxy", label: "代理池", icon: Network },
  { view: "monitor", label: "监控", icon: BarChart3 },
];

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  description?: string;
  labels: string[];
  policy: {
    requestsPerMinute?: number;
    maxConcurrentRequests?: number;
    maxConcurrentStreams?: number;
    allowedModels?: string[];
    allowProxy?: boolean;
  };
  requestCount: number;
  recentClients: Array<{ id: string; userAgent: string; firstSeenAt: string; lastSeenAt: string; requestCount: number }>;
  hasRecoverableKey: boolean;
}

interface ModelItem {
  id: string;
  enabled: boolean;
  ownedBy: string;
  created: number;
  displayName?: string;
}

interface SystemSettings {
  requestBodyLimitBytes: number;
  upstreamTimeoutMs: number;
  defaultStream: boolean;
  logPrompts: boolean;
  openAiStreamTransformModels: string[];
  logEnabled: boolean;
  logAudit: boolean;
  logApiRequests: boolean;
  logMaxBodyChars: number;
  logRetentionDays: number;
}

interface ProxyNode {
  id: string;
  name: string;
  type: "http" | "https" | "socks5";
  url: string;
  enabled: boolean;
  weight: number;
  maxConcurrency: number;
  currentConcurrency: number;
  dailyRequestLimit: number;
  dailyRequestCount: number;
  dailyCountDate: string;
  autoDisableWhenDailyLimitReached: boolean;
  consecutiveRateLimitCount: number;
  cooldownUntil: string | null;
  successCount: number;
  failCount: number;
  recentResults: Array<{ at: string; ok: boolean; statusCode: number }>;
  lastError: string | null;
  lastUsedAt: string | null;
  lastCheckedAt: string | null;
}

interface HealthPayload {
  status: string;
  version: string;
  models: number;
}

interface RuntimePayload {
  runtime: { draining: boolean; inFlightRequests: number };
  limiter: { backend: string; globalRequestsPerMinute: number; apiKeyRequestsPerMinute: number; apiKeyMaxConcurrentRequests: number; apiKeyMaxConcurrentStreams: number };
}

interface MetricsPayload {
  startedAt: string;
  uptimeSeconds: number;
  http: {
    totalRequests: number;
    errorRequests: number;
    errorRate: number;
    byStatus: Record<string, number>;
    byRoute: Record<string, number>;
    latencyMs: { p50: number; p95: number; p99: number };
  };
  upstream: {
    totalRequests: number;
    errorRequests: number;
    errorRate: number;
    byStatus: Record<string, number>;
    byProxy: Record<string, number>;
    latencyMs: { p50: number; p95: number; p99: number };
  };
  recentErrors: Array<{ at: string; scope: string; message: string; statusCode?: number }>;
}

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

class ApiFetchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function apiFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(token ? authHeaders(token) : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    let message = `请求失败：${response.status}`;
    try {
      const data = await response.json();
      message = data?.error?.message || message;
    } catch {
      // Use status message.
    }
    throw new ApiFetchError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function App() {
  const [token, setToken] = useState("");
  const [draftToken, setDraftToken] = useState(() => localStorage.getItem("oph_admin_token") || "");
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [proxies, setProxies] = useState<ProxyNode[]>([]);
  const [runtime, setRuntime] = useState<RuntimePayload | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsPayload | null>(null);
  const [newKeyName, setNewKeyName] = useState("默认用户");
  const [keySearch, setKeySearch] = useState("");
  const [proxyDraft, setProxyDraft] = useState({ name: "香港节点 1", type: "http", url: "", dailyRequestLimit: 1000, maxConcurrency: 10 });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("控制台就绪");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [busy, setBusy] = useState(false);

  const enabledModels = useMemo(() => models.filter((model) => model.enabled), [models]);
  const visibleApiKeys = useMemo(() => {
    const query = keySearch.trim().toLowerCase();
    if (!query) return apiKeys;
    return apiKeys.filter((key) => [key.name, key.keyPrefix, key.description || "", ...key.labels].join(" ").toLowerCase().includes(query));
  }, [apiKeys, keySearch]);
  const aiRequestCount = useMemo(() => {
    const routes = metricsData?.http.byRoute || {};
    return (routes["POST /v1/chat/completions"] || 0) + (routes["POST /v1/messages"] || 0);
  }, [metricsData]);
  const activeProxies = useMemo(() => proxies.filter((proxy) => proxy.enabled), [proxies]);
  const riskProxies = useMemo(() => proxies.filter((proxy) => proxy.consecutiveRateLimitCount > 0 || proxy.lastError), [proxies]);
  const prioritizedProxy = useMemo(() => {
    const now = Date.now();
    return [...proxies]
      .filter((proxy) => proxy.enabled)
      .filter((proxy) => !proxy.cooldownUntil || Date.parse(proxy.cooldownUntil) <= now)
      .filter((proxy) => proxy.dailyRequestLimit === 0 || proxy.dailyRequestCount < proxy.dailyRequestLimit)
      .filter((proxy) => proxy.currentConcurrency < proxy.maxConcurrency)
      .sort((a, b) => b.weight - a.weight)[0] || null;
  }, [proxies]);

  const logout = (message = "已退出控制台") => {
    localStorage.removeItem("oph_admin_token");
    setToken("");
    setAuthMode(null);
    setApiKeys([]);
    setSettings(null);
    setProxies([]);
    setRuntime(null);
    setMetricsData(null);
    setNotice(message);
  };

  const loadPublic = async (activeToken = token) => {
    setBusy(true);
    const [healthData, publicModels] = await Promise.all([
      fetch("/health").then((res) => res.json()),
      fetch("/v1/models").then((res) => res.json()),
    ]);
    setHealth(healthData);
    if (!activeToken) {
      setBusy(false);
      return;
    }
    const [keysData, modelsData, settingsData, proxiesData, runtimeData, metricsResult] = await Promise.all([
      apiFetch<{ data: ApiKeyItem[] }>("/admin/api-keys", activeToken),
      apiFetch<{ data: ModelItem[] }>("/admin/models", activeToken),
      apiFetch<{ data: SystemSettings }>("/admin/settings", activeToken),
      apiFetch<{ data: ProxyNode[] }>("/admin/proxies", activeToken),
      apiFetch<{ data: RuntimePayload }>("/admin/runtime", activeToken),
      apiFetch<{ data: MetricsPayload }>("/admin/metrics", activeToken),
    ]);
    setApiKeys(keysData.data);
    setModels(modelsData.data);
    setSettings(settingsData.data);
    setProxies(proxiesData.data);
    setRuntime(runtimeData.data);
    setMetricsData(metricsResult.data);
    if (!modelsData.data.length && Array.isArray(publicModels.data)) {
      setModels(publicModels.data.map((item: any) => ({ id: item.id, enabled: true, ownedBy: item.owned_by, created: item.created })));
    }
    setBusy(false);
  };

  const login = async (candidate = draftToken) => {
    const cleanToken = candidate.trim();
    if (!cleanToken) {
      setError("请输入控制台密码");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await apiFetch<{ data: { authenticated: boolean; mode: AuthMode } }>("/admin/session", cleanToken);
      localStorage.setItem("oph_admin_token", cleanToken);
      setToken(cleanToken);
      setDraftToken(cleanToken);
      setAuthMode(session.data.mode);
      setNotice("控制台已解锁");
      await loadPublic(cleanToken);
    } catch (err) {
      localStorage.removeItem("oph_admin_token");
      setToken("");
      setAuthMode(null);
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setAuthChecked(true);
      setBusy(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("oph_admin_token") || "";
    if (saved) {
      login(saved);
      return;
    }
    setAuthChecked(true);
    loadPublic("").catch((err: Error) => setError(err.message)).finally(() => setBusy(false));
  }, []);

  const createKey = async () => {
    setError(null);
    setBusy(true);
    const result = await apiFetch<{ data: { key: string } }>("/admin/api-keys", token, {
      method: "POST",
      body: JSON.stringify({ name: newKeyName }),
    });
    setCreatedKey(result.data.key);
    setNotice("API key 已创建，请立即复制；之后不会再次显示明文。");
    await loadPublic();
    setBusy(false);
  };

  const toggleKey = async (item: ApiKeyItem) => {
    setBusy(true);
    await apiFetch(`/admin/api-keys/${item.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !item.enabled }),
    });
    await loadPublic();
    setBusy(false);
  };

  const deleteKey = async (item: ApiKeyItem) => {
    if (!confirm(`确定删除 API key「${item.name}」吗？`)) return;
    setBusy(true);
    await apiFetch(`/admin/api-keys/${item.id}`, token, { method: "DELETE" });
    await loadPublic();
    setBusy(false);
  };

  const editKeyPolicy = async (item: ApiKeyItem) => {
    const raw = prompt("输入 API Key 策略 JSON。留空字段继承全局默认值。", JSON.stringify(item.policy, null, 2));
    if (raw === null) return;
    let policy: ApiKeyItem["policy"];
    try {
      policy = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      setError("策略 JSON 格式不正确");
      return;
    }
    setBusy(true);
    await apiFetch(`/admin/api-keys/${item.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ policy }),
    });
    setNotice("API Key 策略已更新");
    await loadPublic();
    setBusy(false);
  };

  const editKeyMeta = async (item: ApiKeyItem) => {
    const description = prompt("API Key 备注", item.description || "");
    if (description === null) return;
    const labelsRaw = prompt("标签，使用逗号分隔", item.labels.join(", "));
    if (labelsRaw === null) return;
    setBusy(true);
    await apiFetch(`/admin/api-keys/${item.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ description, labels: labelsRaw.split(",").map((label) => label.trim()).filter(Boolean) }),
    });
    setNotice("API Key 元数据已更新");
    await loadPublic();
    setBusy(false);
  };

  const toggleModel = async (model: ModelItem) => {
    setBusy(true);
    await apiFetch(`/admin/models/${encodeURIComponent(model.id)}`, token, {
      method: "PUT",
      body: JSON.stringify({ enabled: !model.enabled, ownedBy: model.ownedBy, created: model.created, displayName: model.displayName }),
    });
    await loadPublic();
    setBusy(false);
  };

  const toggleOpenAiStreamTransform = async (model: ModelItem) => {
    if (!settings) return;
    setBusy(true);
    const current = settings.openAiStreamTransformModels || [];
    const next = current.includes(model.id)
      ? current.filter((id) => id !== model.id)
      : [...current, model.id];
    const result = await apiFetch<{ data: SystemSettings }>("/admin/settings", token, {
      method: "PATCH",
      body: JSON.stringify({ openAiStreamTransformModels: next }),
    });
    setSettings(result.data);
    setNotice(`OpenAI 流式转换白名单已实时${next.includes(model.id) ? "启用" : "关闭"}，新请求立即生效`);
    setBusy(false);
  };

  const updateSettings = async (patch: Partial<SystemSettings>) => {
    setBusy(true);
    const result = await apiFetch<{ data: SystemSettings }>("/admin/settings", token, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setSettings(result.data);
    setNotice("系统设置已更新");
    setBusy(false);
  };

  const copyCreatedKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setNotice("新 API key 已复制到剪贴板");
  };

  const copyStoredKey = async (item: ApiKeyItem) => {
    if (!item.hasRecoverableKey) {
      setError("该 API Key 创建时未保存明文，无法复制；请重新创建一个新 Key。");
      return;
    }
    const result = await apiFetch<{ data: { key: string } }>(`/admin/api-keys/${item.id}/secret`, token);
    await navigator.clipboard.writeText(result.data.key);
    setNotice(`API Key「${item.name}」已复制到剪贴板`);
  };

  const createProxy = async () => {
    setBusy(true);
    await apiFetch("/admin/proxies", token, {
      method: "POST",
      body: JSON.stringify({ ...proxyDraft, type: proxyDraft.type as ProxyNode["type"] }),
    });
    setNotice("代理节点已创建");
    await loadPublic();
    setBusy(false);
  };

  const toggleProxy = async (proxy: ProxyNode) => {
    setBusy(true);
    await apiFetch(`/admin/proxies/${proxy.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !proxy.enabled }),
    });
    await loadPublic();
    setBusy(false);
  };

  const testProxy = async (proxy: ProxyNode) => {
    setBusy(true);
    await apiFetch(`/admin/proxies/${proxy.id}/test`, token, { method: "POST" });
    setNotice(`代理「${proxy.name}」测试成功`);
    await loadPublic();
    setBusy(false);
  };

  const deleteProxy = async (proxy: ProxyNode) => {
    if (!confirm(`确定删除代理「${proxy.name}」吗？`)) return;
    setBusy(true);
    await apiFetch(`/admin/proxies/${proxy.id}`, token, { method: "DELETE" });
    await loadPublic();
    setBusy(false);
  };

  const handleActionError = (err: Error) => {
    if (err instanceof ApiFetchError && err.status === 401) {
      logout("登录状态已失效，请重新登录");
      setError("令牌无效或已失效");
      return;
    }
    setError(err.message);
  };

  const metrics = [
    { label: "网关状态", value: health?.status || "未知", detail: health?.version || "等待连接", tone: "cyan" },
    { label: "API Keys", value: token ? String(apiKeys.length) : "未解锁", detail: token ? "管理权限" : "请输入令牌", tone: "amber" },
    { label: "代理节点", value: token ? String(proxies.length) : "未解锁", detail: activeProxies.length + " 个启用", tone: "red" },
    { label: "AI 请求数", value: token && metricsData ? String(aiRequestCount) : "未解锁", detail: metricsData ? "OpenAI + Anthropic" : "模型调用", tone: "green" },
  ];

  const proxyState = (proxy: ProxyNode) => {
    if (!proxy.enabled) return { label: "已禁用", tone: "disabled" };
    if (proxy.consecutiveRateLimitCount >= 3) return { label: "429 风险", tone: "warning" };
    if (proxy.cooldownUntil && Date.parse(proxy.cooldownUntil) > Date.now()) return { label: "冷却中", tone: "cooldown" };
    if (proxy.lastError) return { label: "异常", tone: "danger" };
    return { label: "健康", tone: "healthy" };
  };

  const recentTape = (proxy: ProxyNode) => {
    const results = proxy.recentResults || [];
    return [...Array(Math.max(0, 20 - results.length)).fill(null), ...results].slice(-20);
  };

  const policySummary = (key: ApiKeyItem) => `RPM ${key.policy.requestsPerMinute ?? "默认"} / 并发 ${key.policy.maxConcurrentRequests ?? "默认"} / 模型 ${(key.policy.allowedModels || []).length || "全部"}`;
  const clientSummary = (key: ApiKeyItem) => key.recentClients.length ? `${key.recentClients.length} 个客户端` : "暂无客户端";
  const clientTitle = (key: ApiKeyItem) => key.recentClients.length ? key.recentClients.map((client) => `${client.id}: ${client.requestCount} 次`).join("\n") : "暂无客户端";

  if (!authChecked) {
    return <main className="loginShell"><div className="ambient ambient-a" /><div className="loginCard"><Radar size={34} /><p className="eyebrow"><span /> 正在验证控制台凭据</p><h1>OpenCodeProxyHub</h1><p className="heroCopy">请稍候，正在检查本地保存的登录状态。</p></div></main>;
  }

  if (!token) {
    return (
      <main className="loginShell">
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />
        <form className="loginCard" onSubmit={(event) => { event.preventDefault(); login().catch((err: Error) => setError(err.message)); }}>
          <div className="brandMark"><Radar size={28} /></div>
          <p className="eyebrow"><span /> 管理控制台登录</p>
          <h1>OpenCodeProxyHub</h1>
          <p className="heroCopy">输入控制台密码后进入管理页面。初始密码为 admin，建议在 Docker 环境变量中修改 ADMIN_PASSWORD。</p>
          <label className="loginField">控制台密码<input value={draftToken} onChange={(event) => setDraftToken(event.target.value)} placeholder="输入控制台密码" type="password" autoFocus /></label>
          <button disabled={busy} type="submit">{busy ? "验证中..." : "进入控制台"}</button>
          {error && <p className="errorText">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <aside className="rail">
        <div className="railBrand"><div className="brandMark"><Radar size={28} /></div><strong>OPH</strong><span>OpenCodeProxyHub</span></div>
        <nav className="railNav" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <button className={view === item.view ? "active" : ""} onClick={() => setView(item.view)} title={item.label} key={item.view}><Icon size={19} /><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="railFooter"><LockKeyhole size={18} /></div>
      </aside>

      <section className="workspace">
        <div className="topStatusBar">
          <div><span className="statusDot" /> OpenCodeProxyHub Control Plane</div>
          <div className="topStatusItems"><span>链式代理：7897</span><span>强制代理：ON</span><span>优先填充策略</span></div>
        </div>
        <header className="heroPanel">
          <div>
            <p className="eyebrow"><span /> Industrial Network Console</p>
            <h1>OpenCodeProxyHub</h1>
            <p className="heroCopy">AI 协议网关、链式代理调度、API Key 权限和上游可观测性集中在一个控制台中。</p>
          </div>
          <div className="heroStatus">
            <div className="pulse"><Activity size={18} /> {busy ? "处理中..." : notice}</div>
            <div className="statusGrid">
              <span>优先节点</span><strong>{prioritizedProxy?.name || "无可用代理"}</strong>
              <span>429 风险</span><strong className={riskProxies.length ? "warn" : ""}>{riskProxies.length} 个节点</strong>
              <span>进行中</span><strong>{runtime?.runtime.inFlightRequests ?? 0}</strong>
            </div>
            <div className="sessionBox"><span>登录模式</span><strong>{authMode === "password" ? "控制台密码" : "已登录"}</strong><button disabled={busy} onClick={() => logout()}>退出登录</button></div>
            {error && <p className="errorText">{error}</p>}
          </div>
        </header>

        <section className="metricsGrid">
          {metrics.map((metric) => (
            <article className={`metric metric-${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </section>

        <section className="mainGrid">
          {view === "dashboard" && <article className="panel span2">
            <div className="panelHeader">
              <div><TerminalSquare size={18} /><h2>网关拓扑</h2></div>
              <button disabled={busy} onClick={() => loadPublic().catch(handleActionError).finally(() => setBusy(false))}>刷新</button>
            </div>
            <div className="topology">
              <div className="node client"><Boxes size={24} /><span>客户端</span><small>Cursor、Cline、Claude Code</small></div>
              <div className="link"><Zap size={18} /></div>
              <div className="node core"><ServerCog size={26} /><span>Fastify 网关</span><small>兼容 OpenAI + Anthropic 协议</small></div>
              <div className="link"><Workflow size={18} /></div>
              <div className="node preproxy"><Route size={24} /><span>7897 前置</span><small>host.docker.internal:7897</small></div>
              <div className="link"><Workflow size={18} /></div>
              <div className="node upstream"><Cable size={24} /><span>Zen 上游</span><small>opencode.ai</small></div>
            </div>
          </article>}

          {view === "dashboard" && <article className="panel keySummaryPanel">
            <div className="panelHeader compact"><div><ShieldCheck size={18} /><h2>API Key 摘要</h2></div><button onClick={() => setView("keys")}>管理</button></div>
            <div className="summaryGrid">
              <div><span>总数</span><strong>{apiKeys.length}</strong></div>
              <div><span>启用</span><strong>{apiKeys.filter((key) => key.enabled).length}</strong></div>
              <div><span>可复制</span><strong>{apiKeys.filter((key) => key.hasRecoverableKey).length}</strong></div>
            </div>
            <div className="tableList compactKeyList">
              {apiKeys.slice(0, 4).map((key) => <div className="row" key={key.id}><div><strong>{key.name}</strong><span>{key.keyPrefix} · 请求 {key.requestCount}</span></div><em className={key.enabled ? "" : "off"}>{key.enabled ? "已启用" : "已禁用"}</em></div>)}
              {apiKeys.length === 0 && <p className="mutedLine">暂无 API Key</p>}
            </div>
          </article>}

          {view === "keys" && <article className="panel keyPanel fullBleed">
            <div className="panelHeader compact"><div><ShieldCheck size={18} /><h2>API Key 管理</h2></div></div>
            <div className="keyToolbar">
              <input value={newKeyName} onChange={(event) => setNewKeyName(event.target.value)} placeholder="新 Key 名称" />
              <button disabled={!token || busy} onClick={() => createKey().catch(handleActionError).finally(() => setBusy(false))}>创建 Key</button>
              <input className="searchInput" value={keySearch} onChange={(event) => setKeySearch(event.target.value)} placeholder="搜索名称、前缀、备注或标签" />
            </div>
            {createdKey && <div className="secretBox"><strong>新建 key 明文</strong><code>{createdKey}</code><button onClick={() => copyCreatedKey().catch(handleActionError)}>复制 key</button></div>}
            <div className="keyTable">
              <div className="keyHeader"><span>状态</span><span>名称</span><span>Key 前缀</span><span>请求</span><span>最近使用</span><span>策略</span><span>客户端</span><span>操作</span></div>
              {visibleApiKeys.map((key) => (
                <div className="keyRow" key={key.id}>
                  <div className="keyStatus" data-label="状态"><span className={key.enabled ? "statusPill enabled" : "statusPill disabled"}>{key.enabled ? "启用" : "禁用"}</span></div>
                  <div className="keyName" data-label="名称"><strong>{key.name}</strong><small>{key.description || "无备注"}</small><div>{key.labels.map((label) => <em key={label}>#{label}</em>)}</div></div>
                  <code className="keyPrefix" data-label="Key 前缀">{key.keyPrefix}</code>
                  <div className="keyCount" data-label="请求">{key.requestCount}</div>
                  <div className="keyLastUsed" data-label="最近使用">{key.lastUsedAt || "从未使用"}</div>
                  <div className="keyPolicy" data-label="策略">{policySummary(key)}</div>
                  <div className="keyClients" data-label="客户端" title={clientTitle(key)}>{clientSummary(key)}</div>
                  <div className="keyActions" data-label="操作"><button disabled={busy || !key.hasRecoverableKey} onClick={() => copyStoredKey(key).catch(handleActionError)}>复制</button><button disabled={busy} onClick={() => editKeyMeta(key).catch(handleActionError).finally(() => setBusy(false))}>备注</button><button disabled={busy} onClick={() => editKeyPolicy(key).catch(handleActionError).finally(() => setBusy(false))}>策略</button><button disabled={busy} onClick={() => toggleKey(key).catch(handleActionError).finally(() => setBusy(false))}>{key.enabled ? "禁用" : "启用"}</button><button className="dangerButton" disabled={busy} onClick={() => deleteKey(key).catch(handleActionError).finally(() => setBusy(false))}>删除</button></div>
                </div>
              ))}
            </div>
          </article>}

          {(view === "dashboard" || view === "models") && <article className="panel modelPanel">
            <div className="panelHeader compact"><div><Activity size={18} /><h2>模型开放面</h2></div></div>
            {view === "models" && <p className="panelHint">OpenAI 流式转换会把白名单模型的 Anthropic SSE 转为 ChatCompletions SSE；保存后热重载，新请求立即生效。</p>}
            <div className="modelStack live modelCards">
              {models.map((model) => {
                const transformEnabled = Boolean(settings?.openAiStreamTransformModels?.includes(model.id));
                return (
                  <div className={model.enabled ? "modelCard" : "modelCard disabled"} key={model.id}>
                    <div className="modelCardHead">
                      <code>{model.id}</code>
                      <span className={model.enabled ? "statusPill enabled" : "statusPill disabled"}>{model.enabled ? "启用" : "禁用"}</span>
                    </div>
                    <div className="modelMeta"><span>{model.ownedBy}</span><span>{model.created}</span></div>
                    <label className="transformToggle">
                      <input disabled={busy || !settings} type="checkbox" checked={transformEnabled} onChange={() => toggleOpenAiStreamTransform(model).catch(handleActionError).finally(() => setBusy(false))} />
                      <span><strong>OpenAI 流式转换</strong><small>{transformEnabled ? "Anthropic SSE -> OpenAI SSE" : "直通上游流式响应"}</small></span>
                    </label>
                    <div className="rowActions modelActions"><button disabled={busy} onClick={() => toggleModel(model).catch(handleActionError).finally(() => setBusy(false))}>{model.enabled ? "禁用模型" : "启用模型"}</button></div>
                  </div>
                );
              })}
            </div>
          </article>}

          {(view === "dashboard" || view === "settings") && <article className="panel settingsPanel">
            <div className="panelHeader compact"><div><SlidersHorizontal size={18} /><h2>系统设置</h2></div></div>
            {settings && <div className="settingsGrid">
              <label>上游超时（毫秒）<input disabled={busy} type="number" value={settings.upstreamTimeoutMs} onChange={(event) => updateSettings({ upstreamTimeoutMs: Number(event.target.value) }).catch(handleActionError).finally(() => setBusy(false))} /></label>
              <label>请求体限制（字节）<input disabled={busy} type="number" value={settings.requestBodyLimitBytes} onChange={(event) => updateSettings({ requestBodyLimitBytes: Number(event.target.value) }).catch(handleActionError).finally(() => setBusy(false))} /></label>
              <label className="switchLine"><input disabled={busy} type="checkbox" checked={settings.defaultStream} onChange={(event) => updateSettings({ defaultStream: event.target.checked }).catch(handleActionError).finally(() => setBusy(false))} /> 默认流式输出</label>
              <label className="switchLine"><input disabled={busy} type="checkbox" checked={settings.logEnabled} onChange={(event) => updateSettings({ logEnabled: event.target.checked }).catch(handleActionError).finally(() => setBusy(false))} /> 启用文件日志</label>
              <label className="switchLine"><input disabled={busy || !settings.logEnabled} type="checkbox" checked={settings.logAudit} onChange={(event) => updateSettings({ logAudit: event.target.checked }).catch(handleActionError).finally(() => setBusy(false))} /> 记录管理审计</label>
              <label className="switchLine"><input disabled={busy || !settings.logEnabled} type="checkbox" checked={settings.logApiRequests} onChange={(event) => updateSettings({ logApiRequests: event.target.checked }).catch(handleActionError).finally(() => setBusy(false))} /> 记录 AI 请求摘要</label>
              <label className="switchLine"><input disabled={busy} type="checkbox" checked={settings.logPrompts} onChange={(event) => updateSettings({ logPrompts: event.target.checked }).catch(handleActionError).finally(() => setBusy(false))} /> 记录 Prompt</label>
              <label>日志最大正文字符<input disabled={busy || !settings.logEnabled} type="number" value={settings.logMaxBodyChars} onChange={(event) => updateSettings({ logMaxBodyChars: Number(event.target.value) }).catch(handleActionError).finally(() => setBusy(false))} /></label>
              <label>日志保留天数<input disabled={busy || !settings.logEnabled} type="number" value={settings.logRetentionDays} onChange={(event) => updateSettings({ logRetentionDays: Number(event.target.value) }).catch(handleActionError).finally(() => setBusy(false))} /></label>
            </div>}
          </article>}

          {(view === "dashboard" || view === "proxy") && <article className={`panel proxyPanel ${view === "proxy" ? "fullBleed" : ""}`}>
            <div className="panelHeader">
              <div><Network size={18} /><h2>出口代理池</h2></div>
              <button disabled={!token || busy} onClick={() => createProxy().catch(handleActionError).finally(() => setBusy(false))}>新增代理</button>
            </div>
            <div className="strategyDeck">
              <div><Route size={18} /><span>当前策略</span><strong>优先填充</strong><small>高权重节点优先，同权重按列表顺序。</small></div>
              <div><AlertTriangle size={18} /><span>429 熔断</span><strong>连续 5 次</strong><small>触发后自动禁用，需手动开启。</small></div>
              <div><CheckCircle2 size={18} /><span>直连回退</span><strong>已禁止</strong><small>REQUIRE_PROXY=true，避免压测污染。</small></div>
            </div>
            <div className="proxyForm">
              <input value={proxyDraft.name} onChange={(event) => setProxyDraft({ ...proxyDraft, name: event.target.value })} placeholder="代理名称" />
              <select value={proxyDraft.type} onChange={(event) => setProxyDraft({ ...proxyDraft, type: event.target.value })}>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
              <input value={proxyDraft.url} onChange={(event) => setProxyDraft({ ...proxyDraft, url: event.target.value })} placeholder="http://user:pass@1.2.3.4:8080" />
              <input type="number" value={proxyDraft.dailyRequestLimit} onChange={(event) => setProxyDraft({ ...proxyDraft, dailyRequestLimit: Number(event.target.value) })} placeholder="每日上限" />
              <input type="number" value={proxyDraft.maxConcurrency} onChange={(event) => setProxyDraft({ ...proxyDraft, maxConcurrency: Number(event.target.value) })} placeholder="并发上限" />
            </div>
            {proxies.length === 0 && <div className="emptyState compactEmpty">
              <div className="scanRing"><Network size={34} /></div>
              <div><h3>尚未配置出口节点</h3><p>添加 HTTP、HTTPS 或 SOCKS5 代理后，网关会优先填充第一个可用节点，连续 5 次 429 会自动禁用该节点。</p></div>
            </div>}
            <div className="proxyGrid">
              {proxies.map((proxy) => {
                const state = proxyState(proxy);
                const isPrimary = prioritizedProxy?.id === proxy.id;
                return (
                  <div className={`proxyCard proxy-${state.tone} ${isPrimary ? "primary" : ""}`} key={proxy.id}>
                    <div className="proxyCardHead"><div><strong>{proxy.name}</strong><code>{proxy.type.toUpperCase()}</code></div><em>{isPrimary ? "当前优先" : state.label}</em></div>
                    <p className="proxyUrl">{proxy.url}</p>
                    <div className="proxyStats">
                      <span><small>今日</small><strong>{proxy.dailyRequestCount}/{proxy.dailyRequestLimit || "不限"}</strong></span>
                      <span><small>并发</small><strong>{proxy.currentConcurrency}/{proxy.maxConcurrency}</strong></span>
                      <span><small>成功</small><strong>{proxy.successCount}</strong></span>
                      <span><small>失败</small><strong>{proxy.failCount}</strong></span>
                    </div>
                    <div className="healthLine"><span>健康状态</span><strong>{state.label}</strong></div>
                    <div className="requestTape" aria-label="最近20次代理请求结果">
                      {recentTape(proxy).map((item, index) => <span className={item ? item.ok ? "ok" : "err" : "empty"} title={item ? `${item.statusCode} · ${item.at}` : "暂无记录"} key={`${proxy.id}-${index}-${item?.at || "empty"}`} />)}
                    </div>
                    <div className="rateLimitRail"><span style={{ width: `${Math.min(100, ((proxy.consecutiveRateLimitCount || 0) / 5) * 100)}%` }} /></div>
                    <div className="proxyMeta"><span>连续 429：{proxy.consecutiveRateLimitCount || 0}/5</span><span>权重：{proxy.weight}</span><span>{proxy.cooldownUntil ? `冷却至 ${proxy.cooldownUntil}` : "未冷却"}</span></div>
                    <p className="proxyError">{proxy.lastError ? `最后错误：${proxy.lastError}` : "状态正常，等待调度。"}</p>
                    <div className="rowActions"><button disabled={busy} onClick={() => toggleProxy(proxy).catch(handleActionError).finally(() => setBusy(false))}>{proxy.enabled ? "禁用" : "启用"}</button><button disabled={busy} onClick={() => testProxy(proxy).catch(handleActionError).finally(() => setBusy(false))}>测试</button><button disabled={busy} onClick={() => deleteProxy(proxy).catch(handleActionError).finally(() => setBusy(false))}>删除</button></div>
                  </div>
                );
              })}
            </div>
          </article>}

          {(view === "dashboard" || view === "monitor") && <article className="panel span2 monitorPanel">
            <div className="panelHeader">
              <div><BarChart3 size={18} /><h2>运行监控</h2></div>
              <button disabled={busy} onClick={() => loadPublic().catch(handleActionError).finally(() => setBusy(false))}>刷新指标</button>
            </div>
            {!token && <div className="emptyState compactEmpty"><div className="scanRing"><BarChart3 size={34} /></div><div><h3>监控视图未解锁</h3><p>输入控制台密码后，可以查看 HTTP、上游、限流器和运行时指标。</p></div></div>}
            {token && metricsData && <div className="monitorGrid">
              <div className="statBlock"><span>HTTP 请求</span><strong>{metricsData.http.totalRequests}</strong><small>错误 {metricsData.http.errorRequests} · P95 {metricsData.http.latencyMs.p95}ms</small></div>
              <div className="statBlock"><span>上游请求</span><strong>{metricsData.upstream.totalRequests}</strong><small>错误 {metricsData.upstream.errorRequests} · P95 {metricsData.upstream.latencyMs.p95}ms</small></div>
              <div className="statBlock"><span>运行状态</span><strong>{runtime?.runtime.draining ? "排水中" : "运行中"}</strong><small>进行中 {runtime?.runtime.inFlightRequests ?? 0} · {runtime?.limiter.backend || "limiter"}</small></div>
              <div className="statBlock"><span>启动时间</span><strong>{Math.floor(metricsData.uptimeSeconds / 60)}m</strong><small>{metricsData.startedAt}</small></div>
            </div>}
            {token && metricsData && <div className="monitorColumns">
              <div><h3>HTTP 状态码</h3>{Object.entries(metricsData.http.byStatus).map(([status, count]) => <p className="kvLine" key={status}><span>{status}</span><strong>{count}</strong></p>)}</div>
              <div><h3>路由热度</h3>{Object.entries(metricsData.http.byRoute).map(([route, count]) => <p className="kvLine" key={route}><span>{route}</span><strong>{count}</strong></p>)}</div>
              <div><h3>最近错误</h3>{metricsData.recentErrors.length === 0 && <p className="mutedLine">暂无错误</p>}{metricsData.recentErrors.map((item) => <p className="errorLine" key={`${item.at}-${item.message}`}><span>{item.scope} · {item.statusCode || "ERR"}</span>{item.message}</p>)}</div>
            </div>}
          </article>}
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
