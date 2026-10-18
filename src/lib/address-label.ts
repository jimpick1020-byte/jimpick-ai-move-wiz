/** 검색 결과가 제공한 이름만 보존하며, 상세주소나 좌표는 변경하지 않습니다. */
export function addressWithBuilding(address: string, buildingName?: string): string {
  const base = address.trim();
  const name = buildingName?.trim() ?? "";
  if (!name || !base || base.replace(/\s/g, "").includes(name.replace(/\s/g, ""))) return base;
  return `${base} (${name})`;
}