import { matchesQuery, searchNorm } from "./item-search";
import type { OptionItem } from "./jimpick";

export interface OptionCatalogItem {
  id: string;
  name: string;
  icon: string;
  aliases?: string[];
}

const aliasWords: [string, string][] = [
  ["쇼파", "소파"], ["티비", "TV"], ["텔레비전", "TV"],
  ["런닝머신", "러닝머신"], ["실내자전거", "스피닝바이크"],
  ["통돌이", "세탁기"], ["장농", "장롱"],
];

export function optionNameKey(name: string): string {
  let key = searchNorm(name);
  for (const [alias, canonical] of aliasWords) key = key.replaceAll(searchNorm(alias), searchNorm(canonical));
  return key;
}

/** Exact names/aliases win; broad names offer candidates rather than guessing a variant. */
export function findOptionCandidates(name: string, catalog: OptionCatalogItem[]): OptionCatalogItem[] {
  const key = optionNameKey(name);
  if (!key) return [];
  const unique = [...new Map(catalog.map((item) => [item.id, item])).values()];
  const fields = (item: OptionCatalogItem) => [item.name, ...(item.aliases ?? [])];
  const exact = unique.filter((item) => fields(item).some((value) => optionNameKey(value) === key));
  if (exact.length) return exact;
  return unique.filter((item) => fields(item).some((value) => matchesQuery(key, optionNameKey(value))));
}

export function createOption(name: string, price: number, item?: OptionCatalogItem): OptionItem {
  const clean = name.trim();
  if (!clean) throw new Error("옵션 품목 이름을 입력해 주세요.");
  return {
    id: `op_${crypto.randomUUID()}`, name: clean, enabled: true, price, separate: false,
    ...(item ? { catalogItemId: item.id, imageUrl: item.icon } : {}),
  };
}