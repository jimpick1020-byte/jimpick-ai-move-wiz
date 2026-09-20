import { listItemIcons } from "./item-icon.functions";
import type { CustomItem } from "./jimpick";

interface StoredIconItem {
  itemId: string;
  name: string;
  cat: string;
  subgroup?: string;
  size?: "소형" | "중형" | "대형";
  volume?: number;
  iconUrl: string;
}

export function iconResultToCustomItem(item: StoredIconItem): CustomItem | null {
  if (!item.itemId || !item.name || !item.cat || !item.iconUrl) return null;
  return {
    id: item.itemId,
    name: item.name,
    cat: item.cat,
    extra: item.volume ?? (item.size === "대형" ? 1 : item.size === "중형" ? 0.5 : 0),
    icon: item.iconUrl,
    subgroup: item.subgroup,
    size: item.size,
    active: true,
  };
}

/** 로그인한 업체의 활성 생성 품목을 서버에서 다시 읽습니다. */
export async function fetchCompanyCustomItems(): Promise<CustomItem[]> {
  const result = await listItemIcons();
  if (!result.ok) throw new Error(result.error || "업체 품목을 불러오지 못했습니다.");
  return result.items
    .map(iconResultToCustomItem)
    .filter((item): item is CustomItem => item !== null);
}