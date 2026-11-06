/**
 * 방 이름 → 대표 그림 종류. 이름만 보고 판단하며 방 ID·품목에는 영향을 주지 않습니다.
 * 번호·띄어쓰기는 무시하고, 더 구체적인 공간(예: '안방 화장실' → 화장실)을 먼저 찾습니다.
 */
export type RoomArtKey =
  | "bathroom" | "kitchen" | "living" | "bedroom" | "small" | "entry"
  | "study" | "dress" | "laundry" | "balcony" | "storage" | "neutral";

/** 앞의 규칙이 우선합니다 (구체적인 공간 → 일반 공간 순서). */
const RULES: [RoomArtKey, string[]][] = [
  ["bathroom", ["화장실", "욕실", "목욕탕", "샤워실", "파우더룸"]],
  ["laundry", ["세탁실", "다용도실"]],
  ["dress", ["드레스룸", "옷방", "드레스"]],
  ["study", ["서재", "공부방", "작업실", "사무실"]],
  ["kitchen", ["주방", "부엌", "키친"]],
  ["balcony", ["베란다", "발코니", "테라스"]],
  ["storage", ["창고", "수납실", "팬트리"]],
  ["living", ["거실"]],
  ["entry", ["입구방"]],
  ["small", ["작은방", "아이방", "자녀방"]],
  ["bedroom", ["안방", "침실", "큰방", "방"]],
];

export function roomArtKey(name: string | null | undefined): RoomArtKey {
  const n = String(name ?? "").replace(/[\s\d\-_.()#·]+/g, "").toLowerCase();
  if (!n) return "neutral";
  for (const [key, words] of RULES) {
    // '방'은 이름이 '방'으로 끝날 때만 침실로 봅니다 (예: '놀이방'). '방'이 포함된 다른 말은 제외.
    if (words.some((w) => (w === "방" ? n.endsWith("방") : n.includes(w)))) return key;
  }
  return "neutral";
}
