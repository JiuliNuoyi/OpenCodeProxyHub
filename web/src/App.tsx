import { useMemo, useState } from "react";
import "./styles.css";
import type { View } from "./types";
import { useConsoleData } from "./hooks/useConsoleData";
import { LoginView } from "./components/LoginView";
import { Layout } from "./components/Layout";
import { StatCards, type StatItem } from "./components/StatCards";
import { Toasts } from "./components/Toasts";
import { DashboardView } from "./views/DashboardView";
import { KeysView } from "./views/KeysView";
import { ModelsView } from "./views/ModelsView";
import { SettingsView } from "./views/SettingsView";
import { ProxyView } from "./views/ProxyView";
import { MonitorView } from "./views/MonitorView";

export default function App() {
  const data = useConsoleData();
  const [view, setView] = useState<View>("dashboard");

  const activeProxies = useMemo(() => data.proxies.filter((p) => p.enabled).length, [data.proxies]);
  const aiRequestCount = useMemo(() => {
    const routes = data.metricsData?.http.byRoute || {};
    return (routes["POST /v1/chat/completions"] || 0) + (routes["POST /v1/messages"] || 0);
  }, [data.metricsData]);

  if (!data.authChecked && !data.token) {
    return <LoginView checking draftToken={data.draftToken} setDraftToken={data.setDraftToken} busy={data.busy} error={data.loginError} onLogin={data.login} />;
  }

  if (!data.token) {
    return (
      <>
        <LoginView draftToken={data.draftToken} setDraftToken={data.setDraftToken} busy={data.busy} error={data.loginError} onLogin={data.login} />
        <Toasts toasts={data.toasts} onDismiss={data.dismissToast} />
      </>
    );
  }

  const stats: StatItem[] = [
    { label: "网关状态", value: data.health?.status || "未知", detail: data.health?.version || "等待连接", tone: "info", icon: "shield" },
    { label: "API Keys", value: String(data.apiKeys.length), detail: `${data.apiKeys.filter((k) => k.enabled).length} 个启用`, tone: "primary", icon: "key" },
    { label: "代理节点", value: String(data.proxies.length), detail: `${activeProxies} 个启用`, tone: "warning", icon: "net" },
    { label: "AI 请求数", value: data.metricsData ? String(aiRequestCount) : "0", detail: "OpenAI + Anthropic", tone: "success", icon: "activity" },
  ];

  const statusText = data.health ? `网关 ${data.health.status} · ${data.health.models} 个模型在线` : "控制台就绪";

  return (
    <>
      <Layout
        view={view}
        onSelect={setView}
        busy={data.busy}
        statusText={statusText}
        authModeLabel={data.authMode === "password" ? "控制台密码" : "已登录"}
        onRefresh={data.refresh}
        onLogout={() => data.logout()}
      >
        <StatCards items={stats} />
        {view === "dashboard" && <DashboardView data={data} onSelect={setView} />}
        {view === "keys" && <KeysView data={data} />}
        {view === "models" && <ModelsView data={data} />}
        {view === "settings" && <SettingsView data={data} />}
        {view === "proxy" && <ProxyView data={data} />}
        {view === "monitor" && <MonitorView data={data} />}
      </Layout>
      <Toasts toasts={data.toasts} onDismiss={data.dismissToast} />
    </>
  );
}
