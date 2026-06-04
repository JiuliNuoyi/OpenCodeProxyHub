export const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

export class ApiFetchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
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
