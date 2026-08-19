import { useEffect, useRef, type DependencyList } from 'react';

export function usePolling(
  cb: () => void,
  intervalMs: number,
  deps: DependencyList = [],
) {
  const ref = useRef<number | null>(null);
  useEffect(() => {
    cb();
    if (ref.current) window.clearInterval(ref.current);
    ref.current = window.setInterval(cb, intervalMs);
    return () => {
      if (ref.current) window.clearInterval(ref.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
