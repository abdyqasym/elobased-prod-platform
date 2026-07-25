import { API_ORIGIN } from "./config";

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
};

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("Backend не запущен. Останови старые процессы и снова выполни npm run dev");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Ошибка сервера" }));
    const fallback = response.status >= 500
      ? "Backend временно недоступен"
      : `Ошибка запроса (${response.status})`;
    throw new Error(payload.error ?? fallback);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function uploadBeat<T>(
  path: string,
  token: string,
  file: File,
): Promise<T> {
  const form = new FormData();
  form.append("beat", file);
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new Error("Backend не запущен. Снова выполни npm run dev");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `Ошибка загрузки (${response.status})` }));
    throw new Error(payload.error ?? "Не удалось загрузить файл");
  }
  return response.json() as Promise<T>;
}
