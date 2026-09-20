import type { CustomItem } from "./jimpick";

/** 안정적인 품목 ID를 기준으로 업체 영구 품목과 견적 스냅샷을 합칩니다. */
export function mergeItemCatalog(
  companyItems: CustomItem[],
  estimateItems: CustomItem[],
): CustomItem[] {
  const merged = new Map<string, CustomItem>();

  for (const item of estimateItems) merged.set(item.id, item);
  for (const item of companyItems) {
    const snapshot = merged.get(item.id);
    merged.set(item.id, snapshot ? { ...snapshot, ...item } : item);
  }

  return Array.from(merged.values());
}