import { useState } from "react";
import { Radar } from "lucide-react";

interface LoginViewProps {
  draftToken: string;
  setDraftToken: (value: string) => void;
  busy: boolean;
  error: string | null;
  onLogin: (token: string) => void;
  checking?: boolean;
}

export function LoginView({ draftToken, setDraftToken, busy, error, onLogin, checking = false }: LoginViewProps) {
  const [local, setLocal] = useState(draftToken);

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-base-200 p-4">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body items-center text-center">
            <span className="loading loading-ring loading-lg text-primary" />
            <p className="text-sm text-base-content/60">正在验证控制台凭据…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-base-200 p-4">
      <form
        className="card w-full max-w-md bg-base-100 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          setDraftToken(local);
          onLogin(local);
        }}
      >
        <div className="card-body gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-content">
              <Radar size={26} />
            </div>
            <div>
              <h1 className="text-xl font-bold">OpenCodeProxyHub</h1>
              <p className="text-xs text-base-content/50">管理控制台登录</p>
            </div>
          </div>
          <p className="text-sm text-base-content/60">
            输入控制台密码后进入管理页面。初始密码为 <code className="rounded bg-base-200 px-1">admin</code>，建议在 Docker 环境变量中修改 ADMIN_PASSWORD。
          </p>
          <label className="form-control w-full">
            <span className="label-text mb-1 text-sm">控制台密码</span>
            <input
              className="input input-bordered w-full"
              value={local}
              onChange={(event) => setLocal(event.target.value)}
              placeholder="输入控制台密码"
              type="password"
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-sm" /> : "进入控制台"}
          </button>
        </div>
      </form>
    </div>
  );
}
