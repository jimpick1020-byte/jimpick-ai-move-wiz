import { useCallback, useEffect, useRef, useState } from "react";

/** Keep the same document mounted during refresh, never reuse it for a new credential. */
export function useRetainedRefresh<T>(identity: string, read: () => Promise<T>, accepted: (data: T) => boolean, intervalMs = 15000) {
  const [state, setState] = useState<{ identity: string; data?: T; error?: string; refreshing: boolean }>({ identity, refreshing: true });
  const current = useRef(identity);
  current.current = identity;
  const readRef = useRef(read);
  const acceptedRef = useRef(accepted);
  readRef.current = read;
  acceptedRef.current = accepted;
  const flight = useRef<string | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (flight.current === identity) return;
    flight.current = identity;
    const request = ++generation.current;
    setState(prev => prev.identity === identity ? { ...prev, refreshing: true } : { identity, refreshing: true });
    try {
      const data = await readRef.current();
      if (!mounted.current || current.current !== identity || request !== generation.current) return;
      // Explicit access rejection clears stale private content; transport failure does not.
      setState({ identity, data, refreshing: false });
    } catch {
      if (mounted.current && current.current === identity && request === generation.current) setState(prev => ({ ...prev, error: "최신 정보를 불러오지 못했습니다. 다시 시도해 주세요.", refreshing: false }));
    } finally {
      if (request === generation.current) flight.current = null;
    }
  }, [identity]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(visible, intervalMs);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => { mounted.current = false; generation.current++; flight.current = null; window.clearInterval(timer); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, [refresh, intervalMs]);
  const visible = state.identity === identity ? state : { identity, refreshing: true };
  return { ...visible, data: visible.data && acceptedRef.current(visible.data) ? visible.data : undefined, rejected: visible.data !== undefined && !acceptedRef.current(visible.data), refresh };
}