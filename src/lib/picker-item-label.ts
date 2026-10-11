const ALIASES: Record<string, string> = { walltv: "벽걸이TV", fridge: "냉장고", box: "박스" };
/** Presentation only: never rewrite stored names or IDs. */
export function pickerItemLabel(id: string, name?: string, recovered?: string): string {
  for (const value of [name, recovered, ALIASES[id]]) {
    if (!value) continue;
    const key = value.replace(/\.(png|jpe?g|webp)$/i, "").toLowerCase();
    if (ALIASES[key]) return ALIASES[key];
    if (/[가-힣]/.test(value) && !/^ci_ai_/i.test(value)) return value;
  }
  return "품목명 확인 필요";
}