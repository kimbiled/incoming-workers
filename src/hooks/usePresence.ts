import { useCallback, useState } from 'react';
import type { Presence } from '@/types/presence';
import { fetchPresence } from '@/lib/api/presence';

export function usePresence() {
  const [rows, setRows] = useState<Presence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (datebegin: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPresence(datebegin);
      setRows(
        data.map((d: Presence) => ({ ...d, uslp_DateEnd: d.uslp_DateEnd ?? null })),
      );
    } catch (e: any) {
      setError(e?.message || 'Ошибка запроса');
    } finally {
      setLoading(false);
    }
  }, []);

  return { rows, loading, error, load };
}
