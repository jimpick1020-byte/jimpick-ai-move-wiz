import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomItem } from "./jimpick";
import { fetchCompanyCustomItems } from "./custom-item-repository";

const cacheKey = (userId: string) => `jimpick_company_items_v2:${userId}`;

function readCache(userId: string): CustomItem[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey(userId)) || "[]") as CustomItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string") : [];
  } catch {
    return [];
  }
}

function writeCache(userId: string, items: CustomItem[]): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(items));
  } catch {
    // 캐시는 보조 수단입니다. 서버 목록이 항상 원본입니다.
  }
}

export function usePersistentItemCatalog(enabled: boolean, userId: string) {
  const [items, setItems] = useState<CustomItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async (): Promise<CustomItem[]> => {
    if (!enabled || !userId) return [];
    const request = ++requestRef.current;
    try {
      const fresh = await fetchCompanyCustomItems();
      if (request === requestRef.current) {
        setItems(fresh);
        setError(null);
        writeCache(userId, fresh);
      }
      return fresh;
    } catch (cause) {
      if (request === requestRef.current) {
        setError(cause instanceof Error ? cause.message : "업체 품목을 불러오지 못했습니다.");
      }
      throw cause;
    }
  }, [enabled, userId]);

  useEffect(() => {
    requestRef.current += 1;
    if (!enabled || !userId) {
      setItems([]);
      setError(null);
      return;
    }
    setItems(readCache(userId));
    void refresh().catch(() => {});
  }, [enabled, userId, refresh]);

  useEffect(() => {
    if (!enabled || !userId) return;
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void refresh().catch(() => {});
    };
    const timer = window.setInterval(refreshVisible, 50 * 60 * 1000);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [enabled, userId, refresh]);

  return { items, error, refresh };
}