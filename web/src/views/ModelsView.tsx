import { Activity } from "lucide-react";
import type { ConsoleData } from "../hooks/useConsoleData";

export function ModelsView({ data }: { data: ConsoleData }) {
  const { models, settings, busy, toggleModel, toggleOpenAiStreamTransform, toggleReasoningTag } = data;

  return (
    <div className="space-y-4">
      <div className="alert bg-base-100 shadow-sm">
        <Activity size={18} className="text-primary" />
        <span className="text-sm text-base-content/70">OpenAI 流式转换会把白名单模型的 Anthropic SSE 转为 ChatCompletions SSE；保存后热重载，新请求立即生效。</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {models.map((model) => {
          const transformEnabled = Boolean(settings?.openAiStreamTransformModels?.includes(model.id));
          const reasoningEnabled = Boolean(settings?.reasoningTagModels?.includes(model.id));
          return (
            <div key={model.id} className={`card bg-base-100 shadow-sm ${model.enabled ? "" : "opacity-60"}`}>
              <div className="card-body gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <code className="break-all text-sm font-semibold">{model.id}</code>
                  <span className={`badge badge-sm shrink-0 ${model.enabled ? "badge-success" : "badge-ghost"}`}>{model.enabled ? "启用" : "禁用"}</span>
                </div>
                <div className="flex gap-3 text-xs text-base-content/50">
                  <span>{model.ownedBy}</span>
                  <span>{model.created}</span>
                </div>

                <label className="oph-inset flex cursor-pointer items-start gap-2 p-2">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm mt-0.5"
                    disabled={busy || !settings}
                    checked={transformEnabled}
                    onChange={() => toggleOpenAiStreamTransform(model)}
                  />
                  <span className="text-xs">
                    <strong className="block">OpenAI 流式转换</strong>
                    <span className="text-base-content/50">{transformEnabled ? "Anthropic SSE → OpenAI SSE" : "直通上游流式响应"}</span>
                  </span>
                </label>

                <label className="oph-inset flex cursor-pointer items-start gap-2 p-2">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm mt-0.5"
                    disabled={busy || !settings}
                    checked={reasoningEnabled}
                    onChange={() => toggleReasoningTag(model)}
                  />
                  <span className="text-xs">
                    <strong className="block">思考标签抽取</strong>
                    <span className="text-base-content/50">{reasoningEnabled ? "<think> → reasoning_content" : "content 内含 <think> 原样直通"}</span>
                  </span>
                </label>

                <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => toggleModel(model)}>
                  {model.enabled ? "禁用模型" : "启用模型"}
                </button>
              </div>
            </div>
          );
        })}
        {models.length === 0 && <p className="text-sm text-base-content/40">暂无模型</p>}
      </div>
    </div>
  );
}
