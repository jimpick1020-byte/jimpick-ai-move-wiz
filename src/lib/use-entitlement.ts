/**
 * 화면에서 「지금 기능을 쓸 수 있는지」 확인합니다.
 *
 * 서버에 저장된 구독·체험 정보만 씁니다 (가짜 값 없음).
 * 결제가 성공하면 refresh() 로 즉시 다시 사용 가능해집니다.
 */
import { useCallback, useEffect, useState } from "react";
import {
  getMyEntitlement,
  TRIAL_EXPIRED_MESSAGE,
  type Entitlement,
} from "@/lib/entitlement.functions";
import { supabase } from "@/integrations/supabase/client";

export { TRIAL_EXPIRED_MESSAGE };
export type { Entitlement };

let cached: Entitlement | null = null;
const listeners = new Set<(e: Entitlement | null) => void>();

/** 결제 직후 등, 권한을 다시 읽습니다 */
export async function refreshEntitlement(): Promise<Entitlement | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      cached = null;
    } else {
      cached = await getMyEntitlement();
    }
  } catch {
    /* 못 읽으면 이전 값을 그대로 씁니다 (기능을 임의로 막지 않습니다) */
  }
  listeners.forEach((fn) => fn(cached));
  return cached;
}

export function useEntitlement() {
  const [ent, setEnt] = useState<Entitlement | null>(cached);
  const [loaded, setLoaded] = useState(cached !== null);

  useEffect(() => {
    const fn = (e: Entitlement | null) => {
      setEnt(e);
      setLoaded(true);
    };
    listeners.add(fn);
    if (cached === null) void refreshEntitlement().then(() => setLoaded(true));
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const refresh = useCallback(async () => {
    await refreshEntitlement();
  }, []);

  /** 서버 값을 못 읽은 동안에는 막지 않습니다 (읽고 나서 판단) */
  const blocked = loaded && ent !== null && !ent.allowed;

  return {
    entitlement: ent,
    loaded,
    blocked,
    remainingText: remainingText(ent),
    refresh,
  };
}

/** 체험 종료까지 남은 날짜·시간 */
export function remainingText(ent: Entitlement | null): string {
  if (!ent || ent.remainingMs <= 0) return "";
  const total = Math.floor(ent.remainingMs / 3600_000);
  const days = Math.floor(total / 24);
  const hours = total % 24;
  if (days > 0) return `${days}일 ${hours}시간 남음`;
  const mins = Math.floor((ent.remainingMs % 3600_000) / 60_000);
  return hours > 0 ? `${hours}시간 ${mins}분 남음` : `${mins}분 남음`;
}
