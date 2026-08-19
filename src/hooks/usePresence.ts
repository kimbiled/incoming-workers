import { useCallback, useState } from 'react';
import type { Presence } from '@/types/presence';
import { fetchPresence } from '@/lib/api/presence';

export function usePresence() {
  const [rows, setRows] = useState<Presence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (datebegin: string, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPresence(datebegin, refresh);
      setRows(
        data.map((d: Presence) => ({ ...d, uslp_DateEnd: d.uslp_DateEnd ?? null })),
      );
    } catch (e: unknown) {
      setError(getPresenceErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { rows, loading, error, load };
}

function getPresenceErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message === 'Failed to fetch' || message.includes('NetworkError')) {
    return 'Не удалось обновить данные. Локальные отметки продолжают сохраняться, повторим синхронизацию позже.';
  }

  return message || 'Ошибка обновления данных';
}
