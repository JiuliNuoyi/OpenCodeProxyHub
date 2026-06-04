import type { ConsoleData } from "../hooks/useConsoleData";
import type { SystemSettings } from "../types";

export function SettingsView({ data }: { data: ConsoleData }) {
  const { settings, busy, updateSettings } = data;
  if (!settings) return <p className="text-sm text-base-content/40">设置加载中…</p>;

  const numberField = (label: string, key: keyof SystemSettings, disabled = false) => (
    <label className="form-control">
      <span className="label-text mb-1 text-sm">{label}</span>
      <input
        className="input input-bordered"
        type="number"
        disabled={busy || disabled}
        value={settings[key] as number}
        onChange={(e) => updateSettings({ [key]: Number(e.target.value) } as Partial<SystemSettings>)}
      />
    </label>
  );

  const toggleField = (label: string, key: keyof SystemSettings, disabled = false) => (
    <label className="oph-inset flex cursor-pointer items-center justify-between p-3">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        className="toggle toggle-primary"
        disabled={busy || disabled}
        checked={settings[key] as boolean}
        onChange={(e) => updateSettings({ [key]: e.target.checked } as Partial<SystemSettings>)}
      />
    </label>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">网关参数</h2>
          {numberField("上游超时（毫秒）", "upstreamTimeoutMs")}
          {numberField("请求体限制（字节）", "requestBodyLimitBytes")}
          {toggleField("默认流式输出", "defaultStream")}
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">日志与审计</h2>
          {toggleField("启用文件日志", "logEnabled")}
          {toggleField("记录管理审计", "logAudit", !settings.logEnabled)}
          {toggleField("记录 AI 请求摘要", "logApiRequests", !settings.logEnabled)}
          {toggleField("记录 Prompt", "logPrompts")}
          <div className="grid grid-cols-2 gap-3">
            {numberField("日志最大正文字符", "logMaxBodyChars", !settings.logEnabled)}
            {numberField("日志保留天数", "logRetentionDays", !settings.logEnabled)}
          </div>
        </div>
      </div>
    </div>
  );
}
