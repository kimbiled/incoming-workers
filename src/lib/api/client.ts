const BASE = process.env.NEXT_PUBLIC_API_BASE as string;
const AUTH = process.env.NEXT_PUBLIC_AUTH_BEARER as string | undefined;

export async function apiGet<T>(path: string, params?: Record<string, string>) {
  const url = new URL(path, BASE);
  if (params)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: AUTH ? { Authorization: `Bearer ${AUTH}` } : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}
