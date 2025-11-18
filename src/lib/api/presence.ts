export async function fetchPresence(datebegin: string) {
  const res = await fetch(`/api/presence?datebegin=${datebegin}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
