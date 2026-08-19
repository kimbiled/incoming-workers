export async function fetchPresence(datebegin: string, refresh = false) {
  const params = new URLSearchParams({ datebegin });
  if (refresh) params.set('refresh', '1');

  const res = await fetch(`/faceid-api/presence?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
