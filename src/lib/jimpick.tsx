import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ============ Types ============
export type MoveType = "포장이사" | "반포장이사" | "일반이사" | "보관이사" | "사무실이사";
export type WorkEnv = "없음" | "계단" | "엘리베이터" | "계단+엘리베이터";
export type EstimateStatus = "작성중" | "진행중" | "완료" | "취소";

export interface RoomItems {
  [itemId: string]: number;
}
export interface Room {
  id: string;
  name: string;
  items: RoomItems;
}
export interface OptionItem {
  id: string;
  name: string;
  enabled: boolean;
  price: number;
  /** 별도(견적 합계에서 제외) */
  separate: boolean;
}
export interface CustomItem {
  id: string;
  name: string;
  cat: string;
  extra: number;
  /** 직접 고른 3D 아이콘 경로 (없으면 이름으로 추천한 아이콘) */
  icon?: string;
  /**
   * 목록에서 지웠는지 (지운 뒤에도 지난 견적서에는 이름·수량이 그대로 남도록
   * 실제로 지우지 않고 이 값만 false 로 바꿉니다)
   */
  active?: boolean;
}
export interface Estimate {
  id: string;
  createdAt: number;
  status: EstimateStatus;
  customerName: string;
  phone: string;
  moveType: MoveType;
  moveDate: string;
  moveTime: string;
  fromAddress: string;
  fromDetail: string;
  toAddress: string;
  toDetail: string;
  /** 출발지·도착지 좌표 (경도 x, 위도 y) */
  fromX?: number | null;
  fromY?: number | null;
  toX?: number | null;
  toY?: number | null;
  distanceKm: number;
  durationMin: number;
  workEnv: WorkEnv;
  fromFloor: number;
  toFloor: number;
  workers: number;
  kitchenStaff: number;
  truck1t: number;
  truck5t: number;
  ladder: number;
  /** 사다리차 상세 */
  ladderFrom: boolean;
  ladderTo: boolean;
  ladderFromPrice: number;
  ladderToPrice: number;
  ladderPrice: number;
  ladderSeparate: boolean;
  /** 사다리차 출발지·도착지 별도 여부 (견적 합계에서 제외) */
  ladderFromSeparate: boolean;
  ladderToSeparate: boolean;
  /** 상세 내역에서 직접 추가·수정하는 항목 */
  extraCharges: { id: string; label: string; amount: number }[];
  /** 고객 메모 */
  memo: string;
  /** 특약사항 */
  specialTerms: string;
  rooms: Room[];
  /** 5단계에서 고른 평수 구간 (예: "30~40평") */
  sizeTab?: string;
  customItems: CustomItem[];
  hiddenItems: string[];
  options: OptionItem[];

  storageStart: string;
  storageEnd: string;
  storageDaily: number;
  /** 보관이사가 아니어도 보관 서비스를 추가한 경우 */
  storageEnabled?: boolean;

  /** 기본 운송료 직접 입력 (null이면 자동 계산) */
  transportOverride?: number | null;
  /** 예상 견적 금액 직접 입력 (null이면 자동 합계) */
  totalOverride?: number | null;
  total: number;

  // ── 종이 견적서 ─────────────────────────────────────────
  /** 견적번호 — 예) JP-2026-0810-001. 견적서를 처음 열 때 붙습니다 */
  sheetNo?: string;
  /** 견적서 차수 — 1차, 2차 수정 견적서 … */
  sheetVersion?: number;
  /** 담당자 이름 (견적서 서명란) */
  staffName?: string;
  /** 담당자 연락처 — 고객이 바로 전화할 수 있게 견적서·공유 화면에 표시됩니다 */
  staffPhone?: string;
  /** 입금 계좌 — 은행 / 계좌번호 / 예금주 */
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  /** 약관 동의 기록 (고객이 공유 화면에서 예약을 확정하면 채워집니다) */
  termsSentAt?: number;
  termsVersion?: string;
  termsViewedAt?: number;
  termsAcceptedAt?: number;
  termsSnapshot?: string;
  reservationConfirmedAt?: number;
  /** 할인 금액 */
  discount?: number;
  /** 예약금 (잔금은 총액 − 예약금으로 계산합니다) */
  deposit?: number;
  /** 견적서 안내 문구 */
  sheetNote?: string;
  /** 확정한 시각 — 확정 뒤에는 금액이 바뀌어도 이 스냅샷을 씁니다 */
  sheetConfirmedAt?: number;
  /** 확정 당시 그대로 얼려 둔 내용 */
  sheetSnapshot?: EstimateSheetSnapshot | null;
  /** 수정·발송 이력 */
  sheetHistory?: SheetHistoryEntry[];
}

/** 확정 당시의 견적서 내용 (단가가 바뀌어도 이 값이 유지됩니다) */
export interface EstimateSheetSnapshot {
  sheetNo: string;
  version: number;
  confirmedAt: number;
  total: number;
  parts: { label: string; amount: number }[];
  rooms: { name: string; items: { id: string; name: string; qty: number }[] }[];
}

/** 견적서 수정·발송 이력 한 줄 */
export interface SheetHistoryEntry {
  version: number;
  at: number;
  staff: string;
  beforeTotal: number;
  afterTotal: number;
  /** 발송한 경우에만 */
  sentAt?: number;
  sentResult?: string;
}

/**
 * 견적번호를 만듭니다 — JP-연도-월일-순번
 * 같은 날 이미 만든 번호를 보고 순번을 올려 중복되지 않게 합니다.
 */
export function makeSheetNo(existing: Estimate[], now = new Date()): string {
  const y = now.getFullYear();
  const md = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const prefix = `JP-${y}-${md}-`;
  const used = existing
    .map((e) => e.sheetNo)
    .filter((n): n is string => !!n && n.startsWith(prefix))
    .map((n) => Number(n.slice(prefix.length)) || 0);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

// ============ Constants ============
export const CATEGORIES = ["전체", "가구", "가전", "주방", "생활용품", "잔짐", "특수"] as const;
export const ITEM_CATALOG: {
  id: string;
  name: string;
  cat: string;
  emoji: string;
  sub?: string;
  extra?: number;
}[] = [
  // ===== 가전 =====
  { id: "fridge", name: "냉장고", cat: "가전", sub: "대형가전", emoji: "🧊", extra: 30000 },
  { id: "kimchi", name: "김치냉장고", cat: "가전", sub: "대형가전", emoji: "🥬", extra: 30000 },
  { id: "minifridge", name: "미니냉장고", cat: "가전", sub: "대형가전", emoji: "🧊" },
  { id: "freezer", name: "냉동고", cat: "가전", sub: "대형가전", emoji: "🧊", extra: 20000 },
  { id: "winecellar", name: "와인셀러", cat: "가전", sub: "대형가전", emoji: "🍷", extra: 20000 },
  { id: "washer", name: "세탁기", cat: "가전", sub: "세탁가전", emoji: "🌀", extra: 20000 },
  { id: "drumwasher", name: "드럼세탁기", cat: "가전", sub: "세탁가전", emoji: "🌀", extra: 20000 },
  { id: "dryer", name: "건조기", cat: "가전", sub: "세탁가전", emoji: "♨️", extra: 20000 },
  { id: "styler", name: "스타일러", cat: "가전", sub: "세탁가전", emoji: "👔", extra: 20000 },
  { id: "tv", name: "TV", cat: "가전", sub: "영상·음향", emoji: "📺", extra: 10000 },
  {
    id: "bigtv",
    name: "대형TV(75인치+)",
    cat: "가전",
    sub: "영상·음향",
    emoji: "📺",
    extra: 30000,
  },
  { id: "walltv", name: "벽걸이TV", cat: "가전", sub: "영상·음향", emoji: "📺", extra: 20000 },
  { id: "projector", name: "프로젝터", cat: "가전", sub: "영상·음향", emoji: "📽️" },
  { id: "speaker", name: "오디오·스피커", cat: "가전", sub: "영상·음향", emoji: "🔊" },
  { id: "console", name: "게임기", cat: "가전", sub: "영상·음향", emoji: "🎮" },
  { id: "aircon", name: "스탠드 에어컨", cat: "가전", sub: "냉난방", emoji: "❄️", extra: 30000 },
  {
    id: "wallaircon",
    name: "벽걸이 에어컨",
    cat: "가전",
    sub: "냉난방",
    emoji: "❄️",
    extra: 20000,
  },
  { id: "airpurifier", name: "공기청정기", cat: "가전", sub: "냉난방", emoji: "🍃" },
  { id: "dehumid", name: "제습기", cat: "가전", sub: "냉난방", emoji: "💨" },
  { id: "humid", name: "가습기", cat: "가전", sub: "냉난방", emoji: "💧" },
  { id: "fan", name: "선풍기", cat: "가전", sub: "냉난방", emoji: "🌬️" },
  { id: "heater", name: "온풍기·히터", cat: "가전", sub: "냉난방", emoji: "🔥" },
  { id: "electricmat", name: "전기장판", cat: "가전", sub: "냉난방", emoji: "🛏️" },
  { id: "pc", name: "컴퓨터·모니터", cat: "가전", sub: "사무·기타", emoji: "🖥️" },
  { id: "printer", name: "프린터", cat: "가전", sub: "사무·기타", emoji: "🖨️" },
  { id: "vacuum", name: "청소기", cat: "가전", sub: "사무·기타", emoji: "🧹" },
  { id: "robotvac", name: "로봇청소기", cat: "가전", sub: "사무·기타", emoji: "🤖" },
  { id: "bidet", name: "비데", cat: "가전", sub: "사무·기타", emoji: "🚽" },
  { id: "sewing", name: "재봉틀", cat: "가전", sub: "사무·기타", emoji: "🧵" },
  {
    id: "digitalpiano",
    name: "디지털 피아노",
    cat: "가전",
    sub: "사무·기타",
    emoji: "🎹",
    extra: 20000,
  },

  // ===== 주방 =====
  { id: "microwave", name: "전자레인지", cat: "주방", sub: "주방가전", emoji: "🍱" },
  { id: "oven", name: "오븐", cat: "주방", sub: "주방가전", emoji: "🔥" },
  { id: "airfryer", name: "에어프라이어", cat: "주방", sub: "주방가전", emoji: "🍟" },
  { id: "gasrange", name: "가스레인지", cat: "주방", sub: "주방가전", emoji: "🔥" },
  { id: "induction", name: "인덕션", cat: "주방", sub: "주방가전", emoji: "🍳" },
  { id: "dishwasher", name: "식기세척기", cat: "주방", sub: "주방가전", emoji: "🍽️", extra: 20000 },
  { id: "waterpurifier", name: "정수기", cat: "주방", sub: "주방가전", emoji: "💧" },
  { id: "riceCooker", name: "밥솥", cat: "주방", sub: "주방가전", emoji: "🍚" },
  { id: "coffee", name: "커피머신", cat: "주방", sub: "주방가전", emoji: "☕" },
  { id: "blender", name: "믹서기", cat: "주방", sub: "주방가전", emoji: "🥤" },
  { id: "toaster", name: "토스터", cat: "주방", sub: "주방가전", emoji: "🍞" },
  { id: "kettle", name: "전기포트", cat: "주방", sub: "주방가전", emoji: "🫖" },
  { id: "dishrack", name: "식기건조대", cat: "주방", sub: "주방살림", emoji: "🍽️" },
  { id: "dishcabinet", name: "그릇장", cat: "주방", sub: "주방살림", emoji: "🍽️", extra: 10000 },
  { id: "kitchencabinet", name: "주방 수납장", cat: "주방", sub: "주방살림", emoji: "🗄️" },
  { id: "potset", name: "냄비·주방용품", cat: "주방", sub: "주방살림", emoji: "🍲" },
  { id: "ricebin", name: "쌀통", cat: "주방", sub: "주방살림", emoji: "🍚" },
  { id: "kimchipot", name: "김치통·장독", cat: "주방", sub: "주방살림", emoji: "🏺" },

  // ===== 가구 =====
  { id: "bed", name: "침대(싱글)", cat: "가구", sub: "침실", emoji: "🛏️", extra: 20000 },
  { id: "bedq", name: "침대(퀸·킹)", cat: "가구", sub: "침실", emoji: "🛏️", extra: 30000 },
  { id: "bunkbed", name: "2층침대", cat: "가구", sub: "침실", emoji: "🛏️", extra: 30000 },
  { id: "babybed", name: "아기침대", cat: "가구", sub: "침실", emoji: "🛏️" },
  { id: "mattress", name: "매트리스", cat: "가구", sub: "침실", emoji: "🛏️", extra: 20000 },
  { id: "wardrobe", name: "장롱", cat: "가구", sub: "침실", emoji: "🚪", extra: 30000 },
  { id: "builtin", name: "붙박이장", cat: "가구", sub: "침실", emoji: "🚪", extra: 30000 },
  { id: "hanger", name: "행거", cat: "가구", sub: "침실", emoji: "👕" },
  { id: "vanity", name: "화장대", cat: "가구", sub: "침실", emoji: "💄" },
  { id: "drawer", name: "서랍장", cat: "가구", sub: "침실", emoji: "🗄️" },
  { id: "nightstand", name: "협탁", cat: "가구", sub: "침실", emoji: "🛋️" },
  { id: "sofa", name: "소파(3인)", cat: "가구", sub: "거실", emoji: "🛋️", extra: 20000 },
  { id: "sofabig", name: "소파(4인 이상)", cat: "가구", sub: "거실", emoji: "🛋️", extra: 30000 },
  { id: "recliner", name: "리클라이너", cat: "가구", sub: "거실", emoji: "🛋️", extra: 20000 },
  { id: "floorsofa", name: "좌식소파", cat: "가구", sub: "거실", emoji: "🛋️" },
  { id: "tvstand", name: "TV장·거실장", cat: "가구", sub: "거실", emoji: "📺", extra: 10000 },
  { id: "teatable", name: "티테이블", cat: "가구", sub: "거실", emoji: "☕" },
  { id: "displaycase", name: "장식장·진열장", cat: "가구", sub: "거실", emoji: "🏺", extra: 10000 },
  { id: "shoerack", name: "신발장", cat: "가구", sub: "거실", emoji: "👟" },
  { id: "table", name: "식탁(4인)", cat: "가구", sub: "주방·식당", emoji: "🍽️", extra: 10000 },
  {
    id: "table6",
    name: "식탁(6인 이상)",
    cat: "가구",
    sub: "주방·식당",
    emoji: "🍽️",
    extra: 20000,
  },
  {
    id: "marbletable",
    name: "대리석 식탁",
    cat: "가구",
    sub: "주방·식당",
    emoji: "🪨",
    extra: 30000,
  },
  { id: "island", name: "아일랜드 식탁", cat: "가구", sub: "주방·식당", emoji: "🍽️", extra: 20000 },
  { id: "chair", name: "의자", cat: "가구", sub: "주방·식당", emoji: "🪑" },
  { id: "desk", name: "책상", cat: "가구", sub: "서재·사무", emoji: "🖥️", extra: 10000 },
  {
    id: "officedesk",
    name: "사무용 책상",
    cat: "가구",
    sub: "서재·사무",
    emoji: "🖥️",
    extra: 10000,
  },
  { id: "officechair", name: "사무용 의자", cat: "가구", sub: "서재·사무", emoji: "🪑" },
  { id: "shelf", name: "책장", cat: "가구", sub: "서재·사무", emoji: "📚", extra: 10000 },
  { id: "wallshelf", name: "벽선반", cat: "가구", sub: "서재·사무", emoji: "🪵" },
  { id: "partition", name: "파티션", cat: "가구", sub: "서재·사무", emoji: "🚧" },
  { id: "foldtable", name: "접이식 테이블", cat: "가구", sub: "서재·사무", emoji: "🪑" },

  // ===== 생활용품 =====
  { id: "drying", name: "빨래건조대", cat: "생활용품", sub: "생활", emoji: "🧺" },
  { id: "toolbox", name: "공구함", cat: "생활용품", sub: "생활", emoji: "🧰" },
  { id: "cleaning", name: "청소도구", cat: "생활용품", sub: "생활", emoji: "🧽" },
  { id: "ladder2", name: "사다리", cat: "생활용품", sub: "생활", emoji: "🪜" },
  { id: "standlight", name: "스탠드 조명", cat: "생활용품", sub: "생활", emoji: "💡" },
  { id: "mirror", name: "전신거울", cat: "생활용품", sub: "생활", emoji: "🪞" },
  { id: "frame", name: "액자", cat: "생활용품", sub: "생활", emoji: "🖼️" },
  { id: "curtain", name: "커튼·블라인드", cat: "생활용품", sub: "생활", emoji: "🪟" },
  { id: "carpet", name: "카펫·러그", cat: "생활용품", sub: "생활", emoji: "🧶" },
  { id: "blanket", name: "이불세트", cat: "생활용품", sub: "생활", emoji: "🛌" },
  { id: "storagebin", name: "정리함", cat: "생활용품", sub: "생활", emoji: "🗃️" },
  { id: "luggage", name: "캐리어·여행가방", cat: "생활용품", sub: "생활", emoji: "🧳" },
  { id: "plant", name: "화분", cat: "생활용품", sub: "취미·레저", emoji: "🪴" },
  {
    id: "bigplant",
    name: "대형화분",
    cat: "생활용품",
    sub: "취미·레저",
    emoji: "🌳",
    extra: 20000,
  },
  { id: "bicycle", name: "자전거", cat: "생활용품", sub: "취미·레저", emoji: "🚲" },
  { id: "kickboard", name: "킥보드", cat: "생활용품", sub: "취미·레저", emoji: "🛴" },
  { id: "golf", name: "골프백", cat: "생활용품", sub: "취미·레저", emoji: "🏌️" },
  { id: "camping", name: "캠핑용품", cat: "생활용품", sub: "취미·레저", emoji: "⛺" },
  { id: "ski", name: "스키·보드", cat: "생활용품", sub: "취미·레저", emoji: "🎿" },
  { id: "fitness", name: "운동기구", cat: "생활용품", sub: "취미·레저", emoji: "🏋️" },
  { id: "stroller", name: "유모차", cat: "생활용품", sub: "유아·반려", emoji: "🍼" },
  { id: "babyitems", name: "아기용품", cat: "생활용품", sub: "유아·반려", emoji: "🧸" },
  { id: "petcage", name: "반려동물 케이지", cat: "생활용품", sub: "유아·반려", emoji: "🐶" },
  { id: "cattower", name: "캣타워", cat: "생활용품", sub: "유아·반려", emoji: "🐱" },

  // ===== 특수·리스크 =====
  { id: "piano", name: "피아노", cat: "특수", sub: "특수운반", emoji: "🎹", extra: 100000 },
  {
    id: "grandpiano",
    name: "그랜드 피아노",
    cat: "특수",
    sub: "특수운반",
    emoji: "🎹",
    extra: 200000,
  },
  { id: "safe", name: "금고", cat: "특수", sub: "특수운반", emoji: "🔐", extra: 100000 },
  { id: "aquarium", name: "어항·수족관", cat: "특수", sub: "특수운반", emoji: "🐠", extra: 50000 },
  { id: "massagechair", name: "안마의자", cat: "특수", sub: "특수운반", emoji: "💆", extra: 50000 },
  { id: "treadmill", name: "러닝머신", cat: "특수", sub: "특수운반", emoji: "🏃", extra: 30000 },
  { id: "bike2", name: "실내자전거", cat: "특수", sub: "특수운반", emoji: "🚴" },
  { id: "art", name: "미술품·조각", cat: "특수", sub: "특수운반", emoji: "🗿", extra: 50000 },
  { id: "waste", name: "폐기물 처리", cat: "특수", sub: "특수운반", emoji: "🗑️" },

  // ===== 잔짐 =====
  { id: "box", name: "이삿짐 박스", cat: "잔짐", sub: "포장 단위", emoji: "📦" },
  { id: "clothbox", name: "옷박스", cat: "잔짐", sub: "포장 단위", emoji: "👕" },
  { id: "bigbox", name: "대박스", cat: "잔짐", sub: "포장 단위", emoji: "📦" },
  { id: "midbox", name: "중박스", cat: "잔짐", sub: "포장 단위", emoji: "🗃️" },
  { id: "bookbox", name: "도서 박스", cat: "잔짐", sub: "포장 단위", emoji: "📚" },
  { id: "kitchenbox", name: "주방 박스", cat: "잔짐", sub: "포장 단위", emoji: "🍽️" },
  { id: "smallbox", name: "잡화 박스", cat: "잔짐", sub: "포장 단위", emoji: "🧺" },
  { id: "basket", name: "바구니", cat: "잔짐", sub: "포장 단위", emoji: "🧺" },
  { id: "bag", name: "잡화 가방", cat: "잔짐", sub: "포장 단위", emoji: "👜" },
  { id: "blanketbag", name: "이불백", cat: "잔짐", sub: "포장 단위", emoji: "🛌" },
  { id: "vinyl", name: "비닐 포장", cat: "잔짐", sub: "포장 단위", emoji: "🛍️" },

  // ===== 새로 추가한 품목 =====
  { id: "cubeshelf", name: "큐브 선반", cat: "가구", sub: "수납", emoji: "🗄️" },
  { id: "cornershelf", name: "코너 선반", cat: "가구", sub: "수납", emoji: "🗄️" },
  { id: "magazinerack", name: "매거진 랙", cat: "가구", sub: "수납", emoji: "🗞️" },
  { id: "recordcabinet", name: "LP장", cat: "가구", sub: "수납", emoji: "💿" },
  { id: "bathcabinet", name: "욕실장", cat: "가구", sub: "수납", emoji: "🚿" },
  { id: "washbasin", name: "세면대", cat: "가구", sub: "수납", emoji: "🚰", extra: 20000 },
  { id: "kitchencart", name: "주방 카트", cat: "주방", sub: "주방 가구", emoji: "🛒" },
  { id: "rollingdrawer", name: "이동식 서랍", cat: "가구", sub: "수납", emoji: "🗃️" },
  { id: "storagebench", name: "수납 벤치", cat: "가구", sub: "거실", emoji: "🪑" },
  { id: "foldwardrobe", name: "접이식 옷장", cat: "가구", sub: "옷·수납", emoji: "🚪" },
  { id: "nestingtable", name: "네스팅 테이블", cat: "가구", sub: "테이블", emoji: "🪑" },
  { id: "bedtable", name: "베드 테이블", cat: "가구", sub: "테이블", emoji: "💻" },
  { id: "kneelchair", name: "무릎 의자", cat: "가구", sub: "의자", emoji: "🪑" },
  { id: "pianobench", name: "피아노 의자", cat: "가구", sub: "의자", emoji: "🎹" },
  { id: "roundstool", name: "원형 스툴", cat: "가구", sub: "의자", emoji: "🪑" },
  { id: "umbrellastand", name: "우산꽂이", cat: "생활용품", sub: "생활", emoji: "☂️" },
  { id: "plantstand", name: "화분 스탠드", cat: "생활용품", sub: "생활", emoji: "🪴" },
  { id: "electricblanket", name: "전기요", cat: "생활용품", sub: "침구", emoji: "🛌" },
  { id: "washerstand", name: "세탁기 받침대", cat: "가전", sub: "세탁가전", emoji: "🧺" },
  { id: "steamer", name: "스팀다리미", cat: "가전", sub: "생활가전", emoji: "♨️" },
  { id: "iron", name: "다리미", cat: "가전", sub: "생활가전", emoji: "👔" },
  { id: "towerfan", name: "타워 선풍기", cat: "가전", sub: "계절가전", emoji: "🌀" },
  { id: "ceilingfan", name: "실링팬", cat: "가전", sub: "계절가전", emoji: "🌀" },
  {
    id: "windowac",
    name: "창문형 에어컨",
    cat: "가전",
    sub: "계절가전",
    emoji: "❄️",
    extra: 20000,
  },
  {
    id: "portableac",
    name: "이동식 에어컨",
    cat: "가전",
    sub: "계절가전",
    emoji: "❄️",
    extra: 10000,
  },
  { id: "breadmaker", name: "제빵기", cat: "주방", sub: "주방가전", emoji: "🍞" },
  { id: "icemaker", name: "제빙기", cat: "주방", sub: "주방가전", emoji: "🧊" },
  { id: "juicer", name: "착즙기", cat: "주방", sub: "주방가전", emoji: "🥤" },
  { id: "handmixer", name: "핸드믹서", cat: "주방", sub: "주방가전", emoji: "🥄" },
  { id: "sandwichgrill", name: "샌드위치 그릴", cat: "주방", sub: "주방가전", emoji: "🥪" },
  { id: "highchair", name: "아기 식탁의자", cat: "생활용품", sub: "유아", emoji: "🍼" },
  { id: "changingtable", name: "기저귀 교환대", cat: "생활용품", sub: "유아", emoji: "🍼" },
  { id: "playpen", name: "놀이울", cat: "생활용품", sub: "유아", emoji: "🧸" },
  { id: "safetygate", name: "안전문", cat: "생활용품", sub: "유아", emoji: "🚧" },
  { id: "toybox", name: "장난감 정리함", cat: "생활용품", sub: "유아", emoji: "🧸" },
  { id: "kidsslide", name: "미끄럼틀", cat: "생활용품", sub: "유아", emoji: "🛝" },
  { id: "doghouse", name: "개집", cat: "생활용품", sub: "반려동물", emoji: "🐶" },
  { id: "petstroller", name: "펫 유모차", cat: "생활용품", sub: "반려동물", emoji: "🐕" },
  { id: "birdcage", name: "새장", cat: "생활용품", sub: "반려동물", emoji: "🐦" },
  { id: "reptiletank", name: "파충류 사육장", cat: "생활용품", sub: "반려동물", emoji: "🦎" },
  { id: "bbqgrill", name: "바비큐 그릴", cat: "생활용품", sub: "레저", emoji: "🍖" },
  { id: "parasol", name: "파라솔", cat: "생활용품", sub: "레저", emoji: "⛱️" },
  { id: "campingtable", name: "캠핑 테이블", cat: "생활용품", sub: "레저", emoji: "🏕️" },
  { id: "bikestand", name: "자전거 거치대", cat: "생활용품", sub: "레저", emoji: "🚲" },
  { id: "surfboard", name: "서핑보드", cat: "생활용품", sub: "레저", emoji: "🏄" },
  { id: "kayak", name: "카약", cat: "특수", sub: "대형", emoji: "🛶", extra: 30000 },
  { id: "sleepingbag", name: "침낭", cat: "생활용품", sub: "레저", emoji: "🛌" },
  { id: "fishing", name: "낚시 장비", cat: "생활용품", sub: "레저", emoji: "🎣" },
  { id: "wheelchair", name: "휠체어", cat: "특수", sub: "의료", emoji: "♿" },
  { id: "hospitalbed", name: "환자용 침대", cat: "특수", sub: "의료", emoji: "🛏️", extra: 30000 },
  { id: "massagetable", name: "마사지 테이블", cat: "특수", sub: "의료", emoji: "💆" },
  { id: "turntable", name: "턴테이블", cat: "가전", sub: "영상·음향", emoji: "🎵" },
  { id: "guitar", name: "기타", cat: "특수", sub: "악기", emoji: "🎸" },
  { id: "cello", name: "첼로·바이올린", cat: "특수", sub: "악기", emoji: "🎻" },
  { id: "drumset", name: "드럼 세트", cat: "특수", sub: "악기", emoji: "🥁", extra: 30000 },
  { id: "karaoke", name: "노래방 기계", cat: "가전", sub: "영상·음향", emoji: "🎤" },
  { id: "camera", name: "카메라 장비", cat: "생활용품", sub: "취미", emoji: "📷" },
  { id: "telescope", name: "망원경", cat: "생활용품", sub: "취미", emoji: "🔭" },
  { id: "dressform", name: "마네킹", cat: "생활용품", sub: "취미", emoji: "👗" },
  { id: "easel", name: "이젤", cat: "생활용품", sub: "취미", emoji: "🎨" },
  { id: "potterywheel", name: "도예 물레", cat: "특수", sub: "취미", emoji: "🏺", extra: 20000 },
  { id: "yogamat", name: "요가 매트", cat: "생활용품", sub: "취미", emoji: "🧘" },
  { id: "rowing", name: "로잉머신", cat: "특수", sub: "운동", emoji: "🚣", extra: 20000 },
  { id: "boardgame", name: "보드게임", cat: "잔짐", sub: "취미", emoji: "🎲" },
  { id: "figurecase", name: "피규어 진열장", cat: "생활용품", sub: "취미", emoji: "🤖" },
];

// ============ 트럭 적재량 ============
/**
 * 품목 1개가 차지하는 부피 (루베 = m³).
 *
 * 현장에서 쓰는 어림값입니다. 회사마다 기준이 다르면 이 숫자만 고치면
 * 6단계 트럭 게이지가 통째로 따라 움직입니다.
 */
export const ITEM_VOLUME: Record<string, number> = {
  // 가전
  fridge: 1.0,
  kimchi: 0.8,
  minifridge: 0.3,
  freezer: 0.6,
  winecellar: 0.5,
  washer: 0.6,
  drumwasher: 0.7,
  dryer: 0.6,
  styler: 0.5,
  tv: 0.3,
  bigtv: 0.6,
  walltv: 0.25,
  projector: 0.1,
  speaker: 0.25,
  console: 0.08,
  aircon: 0.5,
  wallaircon: 0.3,
  airpurifier: 0.2,
  dehumid: 0.2,
  humid: 0.1,
  fan: 0.15,
  heater: 0.15,
  electricmat: 0.08,
  pc: 0.2,
  printer: 0.1,
  vacuum: 0.1,
  robotvac: 0.08,
  bidet: 0.08,
  sewing: 0.3,
  digitalpiano: 0.5,
  // 주방
  microwave: 0.12,
  oven: 0.15,
  airfryer: 0.06,
  gasrange: 0.1,
  induction: 0.05,
  dishwasher: 0.4,
  waterpurifier: 0.2,
  riceCooker: 0.05,
  coffee: 0.08,
  blender: 0.04,
  toaster: 0.03,
  kettle: 0.03,
  dishrack: 0.1,
  dishcabinet: 0.8,
  kitchencabinet: 0.7,
  potset: 0.15,
  ricebin: 0.1,
  kimchipot: 0.12,
  // 가구
  bed: 1.2,
  bedq: 1.8,
  bunkbed: 2.5,
  babybed: 0.6,
  mattress: 0.8,
  wardrobe: 2.0,
  builtin: 2.0,
  hanger: 0.3,
  vanity: 0.5,
  drawer: 0.6,
  nightstand: 0.2,
  sofa: 1.6,
  sofabig: 2.2,
  recliner: 1.0,
  floorsofa: 0.8,
  tvstand: 0.7,
  teatable: 0.4,
  displaycase: 0.9,
  shoerack: 0.5,
  table: 0.8,
  table6: 1.2,
  marbletable: 1.2,
  island: 1.0,
  chair: 0.2,
  desk: 0.6,
  officedesk: 0.8,
  officechair: 0.3,
  shelf: 0.7,
  wallshelf: 0.2,
  partition: 0.3,
  foldtable: 0.2,
  // 생활용품
  drying: 0.15,
  toolbox: 0.08,
  cleaning: 0.1,
  ladder2: 0.2,
  standlight: 0.15,
  mirror: 0.2,
  frame: 0.1,
  curtain: 0.05,
  carpet: 0.15,
  blanket: 0.12,
  storagebin: 0.12,
  luggage: 0.15,
  plant: 0.1,
  bigplant: 0.4,
  bicycle: 0.5,
  kickboard: 0.15,
  golf: 0.2,
  camping: 0.3,
  ski: 0.15,
  fitness: 0.3,
  stroller: 0.3,
  babyitems: 0.2,
  petcage: 0.2,
  cattower: 0.35,
  // 특수
  piano: 1.5,
  grandpiano: 3.0,
  safe: 0.4,
  aquarium: 0.8,
  massagechair: 1.5,
  treadmill: 1.2,
  bike2: 0.6,
  art: 0.3,
  waste: 0.5,
  // 잔짐
  box: 0.1,
  clothbox: 0.15,
  bigbox: 0.12,
  midbox: 0.08,
  bookbox: 0.06,
  kitchenbox: 0.08,
  smallbox: 0.06,
  basket: 0.06,
  bag: 0.05,
  blanketbag: 0.14,
  vinyl: 0.05,
};

/** 목록에 없는 품목(직접 추가·AI 인식)은 분류만 보고 어림잡습니다 */
const VOLUME_BY_CAT: Record<string, number> = {
  가전: 0.4,
  주방: 0.15,
  가구: 0.8,
  생활용품: 0.15,
  특수: 1.0,
  잔짐: 0.1,
};
const DEFAULT_VOLUME = 0.3;

/**
 * 차량 한 대가 싣는 부피 (루베).
 * 적재함 실치수에서 쌓는 높이를 고려한 실적재 기준입니다.
 *   1톤 탑차 약 2.8 × 1.6 × 1.8 m,  5톤 약 6.2 × 2.1 × 2.2 m
 */
export const TRUCK_CAPACITY = { truck1t: 8, truck5t: 28 } as const;

/** 품목 1개의 부피 */
export function volumeOf(id: string, cat?: string): number {
  return ITEM_VOLUME[id] ?? VOLUME_BY_CAT[cat ?? ""] ?? DEFAULT_VOLUME;
}

export interface TruckLoad {
  /** 담긴 짐 전체 부피 (루베) */
  volume: number;
  /** 4단계에서 고른 차량이 실을 수 있는 부피 */
  capacity: number;
  /** 적재율 0~ (100 이 꽉 참) */
  percent: number;
  /** 고른 차량으로 부족한 부피 */
  shortage: number;
  /**
   * empty  담긴 짐 없음
   * none   짐은 있는데 차량을 아직 안 고름
   * ok     여유 있음 (85% 이하)
   * tight  거의 꽉 참 (85~100%)
   * over   넘침 — 차량을 늘려야 함
   */
  status: "empty" | "none" | "ok" | "tight" | "over";
  /** 이 짐을 실으려면 최소 몇 대가 필요한지 */
  need: { truck1t: number; truck5t: number };
}

/** 필요한 차량 조합을 가장 적은 대수로 계산 */
export function suggestTrucks(volume: number): { truck1t: number; truck5t: number } {
  if (volume <= 0) return { truck1t: 0, truck5t: 0 };
  let truck5t = Math.floor(volume / TRUCK_CAPACITY.truck5t);
  const rest = volume - truck5t * TRUCK_CAPACITY.truck5t;
  let truck1t = Math.ceil(rest / TRUCK_CAPACITY.truck1t);
  // 1톤 여러 대를 부르느니 5톤 한 대가 낫습니다
  // (1톤들이 5톤 한 대의 3/4 이상을 채우면 5톤으로 올립니다)
  if (truck1t * TRUCK_CAPACITY.truck1t >= TRUCK_CAPACITY.truck5t * 0.75) {
    truck5t += 1;
    truck1t = 0;
  }
  return { truck1t, truck5t };
}

/**
 * 담긴 짐이 고른 차량에 들어가는지 계산합니다.
 * 6단계 트럭 게이지가 이 값 하나로 움직입니다.
 */
export function calcTruckLoad(e: Estimate): TruckLoad {
  const custom = new Map((e.customItems ?? []).map((c) => [c.id, c.cat]));
  let volume = 0;
  for (const room of e.rooms ?? []) {
    for (const [id, qty] of Object.entries(room.items ?? {})) {
      if (!qty || qty <= 0) continue;
      const cat = ITEM_CATALOG.find((i) => i.id === id)?.cat ?? custom.get(id);
      volume += volumeOf(id, cat) * qty;
    }
  }
  volume = Math.round(volume * 100) / 100;

  const capacity =
    (e.truck1t || 0) * TRUCK_CAPACITY.truck1t + (e.truck5t || 0) * TRUCK_CAPACITY.truck5t;
  const percent = capacity > 0 ? Math.round((volume / capacity) * 100) : 0;
  const shortage = Math.max(0, Math.round((volume - capacity) * 100) / 100);

  let status: TruckLoad["status"];
  if (volume <= 0) status = "empty";
  else if (capacity <= 0) status = "none";
  else if (percent > 100) status = "over";
  else if (percent >= 85) status = "tight";
  else status = "ok";

  return { volume, capacity, percent, shortage, status, need: suggestTrucks(volume) };
}

// ============ 자주 담는 품목 ============
/** 이력이 없을 때 처음 보여 줄 기본 목록 */
const DEFAULT_FREQUENT = ["fridge", "washer", "bed", "wardrobe", "sofa", "tv", "table", "midbox"];

/**
 * 지금까지 쓴 견적에서 자주 담은 품목을 뽑습니다.
 *
 * "몇 개를 담았나"가 아니라 "몇 건의 견적에 나왔나"로 셉니다.
 * 박스를 20개 담은 견적 한 건 때문에 박스가 1등이 되는 걸 막기 위해서입니다.
 */
export function frequentItemIds(estimates: Estimate[], limit = 8): string[] {
  const count = new Map<string, number>();
  for (const e of estimates ?? []) {
    const seen = new Set<string>();
    for (const room of e.rooms ?? []) {
      for (const [id, qty] of Object.entries(room.items ?? {})) {
        if (qty > 0) seen.add(id);
      }
    }
    for (const id of seen) count.set(id, (count.get(id) ?? 0) + 1);
  }

  const ranked = [...count.entries()]
    // 딱 한 번 나온 품목은 "자주"가 아닙니다.
    // (피아노를 한 번 옮겼다고 자주 담는 품목에 올라오면 안 됩니다)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    // 지워졌거나 이 기기에 없는 직접추가 품목은 뺍니다
    .filter((id) => ITEM_CATALOG.some((i) => i.id === id));

  // 이력이 모자라면 기본 목록으로 채웁니다
  const out = [...ranked];
  for (const id of DEFAULT_FREQUENT) {
    if (out.length >= limit) break;
    if (!out.includes(id)) out.push(id);
  }
  return out.slice(0, limit);
}

export const DEFAULT_ROOMS = ["안방", "작은방", "입구방", "거실", "부엌", "베란다"];
/** 옵션 품목은 기본값 없이 사용자가 직접 추가합니다. */
export const DEFAULT_OPTIONS: OptionItem[] = [];
/** 견적서에 자주 쓰는 옵션 금액 (빠른 추가용, 금액은 수정 가능) */
export const OPTION_PRESETS: { name: string; price: number }[] = [
  { name: "에어컨 이전 설치", price: 150000 },
  { name: "에어컨 철거", price: 80000 },
  { name: "세탁기 설치", price: 30000 },
  { name: "입주 청소", price: 250000 },
  { name: "폐기물 처리", price: 100000 },
  { name: "장롱 분해·조립", price: 100000 },
  { name: "피아노 운반", price: 200000 },
  { name: "금고 운반", price: 150000 },
  { name: "포장 자재비", price: 50000 },
  { name: "주차/도로 사용료", price: 30000 },
];

/** 기본 품목 프리셋 없음 — 품목은 사장님이 직접 담습니다. */
export const PRESET_30PY: Record<string, RoomItems> = {};

// ============ Pricing ============
export interface Pricing {
  truck1t: number;
  truck5t: number;
  ladder: number;
  worker: number;
  kitchenStaff: number;
  baseKm: number;
  perKm: number;
  stairPerFloor: number;
}

export const DEFAULT_PRICING: Pricing = {
  truck1t: 250000,
  truck5t: 850000,
  ladder: 200000,
  worker: 150000,
  kitchenStaff: 150000,
  baseKm: 20,
  perKm: 2000,
  stairPerFloor: 30000,
};

const PRICING_KEY = "jimpick_pricing_v1";

/** 업체별 단가 (설정 화면에서 수정 가능) */
export function getPricing(): Pricing {
  if (typeof window === "undefined") return DEFAULT_PRICING;
  try {
    const raw = localStorage.getItem(PRICING_KEY);
    if (!raw) return DEFAULT_PRICING;
    return { ...DEFAULT_PRICING, ...(JSON.parse(raw) as Partial<Pricing>) };
  } catch {
    return DEFAULT_PRICING;
  }
}

export function savePricing(p: Pricing) {
  try {
    localStorage.setItem(PRICING_KEY, JSON.stringify(p));
  } catch {}
}

/** @deprecated getPricing() 사용 */
export const PRICING = DEFAULT_PRICING;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 보관 일수 (시작일·종료일 기준). 종료일이 빠르면 -1 */
export function storageDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  const d = Math.round((e - s) / 86400000);
  return d < 0 ? -1 : d;
}

/** 보관 서비스 사용 여부 */
export function usesStorage(e: Estimate): boolean {
  return e.moveType === "보관이사" || Boolean(e.storageEnabled);
}

export function storageFeeOf(e: Estimate): number {
  if (!usesStorage(e)) return 0;
  const days = storageDays(e.storageStart, e.storageEnd);
  if (days <= 0) return 0;
  return days * Math.max(0, num(e.storageDaily));
}

/** 5톤 차량 1대에 기본 포함되는 인원 */
export const BASE_WORKERS = 2;
export const BASE_KITCHEN = 1;

/** 중앙 견적 계산 서비스 — 모든 화면이 이 함수만 사용합니다. */
export function calcEstimate(
  e: Estimate,
  pricing: Pricing = getPricing(),
): { total: number; parts: { label: string; amount: number }[] } {
  const hasSidePrice = num(e.ladderFromPrice) + num(e.ladderToPrice) > 0;
  const sideFee =
    (e.ladderFromSeparate ? 0 : num(e.ladderFromPrice)) +
    (e.ladderToSeparate ? 0 : num(e.ladderToPrice));
  const ladderCount = num(e.ladder) || (e.ladderFrom ? 1 : 0) + (e.ladderTo ? 1 : 0);
  const ladderFee = e.ladderSeparate
    ? 0
    : hasSidePrice
      ? sideFee
      : num(e.ladderPrice) || ladderCount * pricing.ladder;

  /** 차량 선택은 종류별로 1회만 금액에 반영합니다 (대수 곱하지 않음) */
  const truck5Fee = num(e.truck5t) > 0 ? pricing.truck5t : 0;
  const truck1Fee = num(e.truck1t) > 0 ? pricing.truck1t : 0;
  const extraKm = Math.max(0, num(e.distanceKm) - pricing.baseKm);
  const distanceFee = Math.round(extraKm * pricing.perKm);
  const stairFloors = e.workEnv.includes("계단")
    ? Math.max(0, num(e.fromFloor) - 1) + Math.max(0, num(e.toFloor) - 1)
    : 0;
  const stairFee = stairFloors * pricing.stairPerFloor;

  /** 수작업 비용 — 사다리차를 쓰지 않는 구간만 인원 1명당 2만원 */
  const manualWork = e.workEnv.includes("계단") || e.workEnv.includes("엘리베이터");
  const manualSides = manualWork ? (e.ladderFrom ? 0 : 1) + (e.ladderTo ? 0 : 1) : 0;
  const manualWorkers = Math.max(0, num(e.workers));
  const MANUAL_PER_WORKER = 20000;
  const manualFee = manualSides * manualWorkers * MANUAL_PER_WORKER;
  const manualSideLabel =
    manualSides === 2
      ? "출발지·도착지"
      : manualSides === 1
        ? e.ladderFrom
          ? "도착지"
          : "출발지"
        : "";

  /**
   * 기본 운송료 — 사다리차는 여기에 넣지 않습니다.
   * 사다리 금액은 사장님이 직접 넣는 값이라, 운송료를 직접 입력해 두었더라도
   * 옵션·보관료처럼 항상 따로 더해져야 합니다.
   */
  const autoTransport = truck5Fee + truck1Fee + distanceFee + stairFee + manualFee;
  const overridden = e.transportOverride !== null && e.transportOverride !== undefined;
  const transport = overridden ? num(e.transportOverride) : autoTransport;

  const optionFee = e.options
    .filter((o) => o.enabled && !o.separate)
    .reduce((s, o) => s + Math.max(0, num(o.price)), 0);
  const storageFee = storageFeeOf(e);
  const extras = (e.extraCharges ?? []).reduce((s2, x) => s2 + num(x.amount), 0);

  const sum = transport + ladderFee + optionFee + storageFee + extras;
  const raw =
    e.totalOverride === null || e.totalOverride === undefined ? sum : num(e.totalOverride);
  const total = Math.max(0, Math.round(Number.isFinite(raw) ? raw : 0));

  const parts = overridden
    ? [{ label: "기본 운송료 (직접 입력)", amount: transport }]
    : [
        { label: "기본 차량 비용 (5톤)", amount: truck5Fee },
        { label: "차 증차비용 (1톤)", amount: truck1Fee },
        {
          label: `거리 추가비 (${pricing.baseKm}km 초과 ${extraKm.toFixed(1)}km)`,
          amount: distanceFee,
        },
        { label: `계단 추가비 (${stairFloors}개 층)`, amount: stairFee },
        // 이 두 줄이 없으면 합계와 항목 합이 어긋납니다
        {
          label: `수작업 비용${manualSideLabel ? ` (${manualSideLabel})` : ""}`,
          amount: manualFee,
        },
      ].filter((p) => p.amount > 0);

  return {
    total,
    parts: [
      ...(parts.length > 0 ? parts : [{ label: "기본 운송료", amount: transport }]),
      // 사다리차는 운송료를 직접 입력해도 항상 따로 보여 줍니다
      ...(ladderFee > 0 ? [{ label: "사다리차 비용", amount: ladderFee }] : []),
      ...(optionFee > 0 ? [{ label: "옵션 비용", amount: optionFee }] : []),
      ...(storageFee > 0 ? [{ label: "보관료", amount: storageFee }] : []),
      ...(e.extraCharges ?? []).map((x) => ({
        label: x.label || "추가 항목",
        amount: num(x.amount),
      })),
    ],
  };
}

// ============ Store ============
export function newEstimate(): Estimate {
  return {
    id: `est_${Date.now()}`,
    createdAt: Date.now(),
    status: "작성중",
    customerName: "",
    phone: "",
    moveType: "포장이사",
    moveDate: "",
    moveTime: "오전 09:00",
    fromAddress: "",
    fromDetail: "",
    toAddress: "",
    toDetail: "",
    fromX: null,
    fromY: null,
    toX: null,
    toY: null,
    distanceKm: 0,
    durationMin: 0,
    workEnv: "엘리베이터",
    fromFloor: 1,
    toFloor: 1,
    workers: 2,
    kitchenStaff: 1,
    truck1t: 0,
    truck5t: 0,

    ladder: 0,
    ladderFrom: false,
    ladderTo: false,
    ladderFromPrice: 0,
    ladderToPrice: 0,
    ladderPrice: 0,
    ladderSeparate: false,
    ladderFromSeparate: false,
    ladderToSeparate: false,
    extraCharges: [],
    memo: "",
    specialTerms: "",
    rooms: DEFAULT_ROOMS.map((n) => ({ id: `r_${n}`, name: n, items: {} as RoomItems })),
    sizeTab: "30~40평",

    customItems: [],
    hiddenItems: [],
    options: [...DEFAULT_OPTIONS],
    storageStart: "",
    storageEnd: "",
    storageDaily: 20000,
    storageEnabled: false,

    transportOverride: null,
    totalOverride: null,
    total: 0,
  };
}

export type Screen =
  | "splash"
  | "login"
  | "home"
  | "step1"
  | "step2"
  | "step3"
  | "step4"
  | "step6"
  | "plan"
  | "ai"
  | "options"
  | "result"
  | "history"
  | "customers"
  | "signup"
  | "subscription"
  | "settings"
  | "stats";

interface AppState {
  loggedIn: boolean;
  savedId: string;
  screen: Screen;
  draft: Estimate;
  estimates: Estimate[];
  currentRoomId: string;
  /** 5~6단계 진입 직전에 자동 저장되는 스냅샷 */
  stepSnapshot?: Estimate | null;
}

interface Ctx extends AppState {
  setScreen: (s: Screen) => void;
  login: (id: string, remember: boolean) => void;
  logout: () => void;
  updateDraft: (patch: Partial<Estimate>) => void;
  resetDraft: () => void;
  saveDraft: () => void;
  deleteEstimate: (id: string) => void;
  loadEstimate: (id: string) => void;
  setCurrentRoom: (id: string) => void;
  /** 5~6단계 변경 직전 스냅샷으로 즉시 복원 */
  restoreStepSnapshot: () => boolean;
}

const AppCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "jimpick_v8_state";

export function JimpickProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({
    loggedIn: false,
    savedId: "",
    screen: "splash" as Screen,
    draft: newEstimate(),
    estimates: [],
    currentRoomId: "",
    stepSnapshot: null,
  }));

  const [hydrated, setHydrated] = useState(false);

  // 하이드레이션 이후에 저장된 상태를 불러옵니다 (SSR 불일치 방지)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as AppState;
        setState({ ...s, screen: s.loggedIn ? "home" : "splash" });
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  // 휴대폰(갤럭시 등) 뒤로가기 버튼 처리.
  // 쌓아 둔 기록으로 돌아가고, 기록이 없으면 첫 화면으로 갑니다.
  // 작성 중인 고객·품목 정보는 그대로 두고 화면만 바꿉니다.
  useEffect(() => {
    if (!hydrated) return;
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { jpScreen?: Screen } | null)?.jpScreen;
      setState((prev) => {
        if (!prev.loggedIn) return prev;
        return { ...prev, screen: s ?? "home" };
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [hydrated]);

  const ctx: Ctx = {
    ...state,
    setScreen: (screen) =>
      setState((s) => {
        // 5단계(품목 입력) 진입 직전 상태를 스냅샷으로 보관합니다
        const entering5 =
          screen === "step6" && s.screen !== "step6" && s.screen !== "plan" && s.screen !== "ai";
        // 휴대폰 뒤로가기 버튼이 앱을 닫지 않고 이전 화면으로 가도록
        // 화면을 옮길 때마다 기록을 하나 쌓습니다 (갤럭시 크롬 포함)
        if (typeof window !== "undefined" && screen !== s.screen) {
          try {
            window.history.pushState({ jpScreen: screen }, "");
          } catch {
            /* 기록을 못 쌓아도 화면 이동은 그대로 합니다 */
          }
        }
        return {
          ...s,
          screen,
          stepSnapshot: entering5 ? JSON.parse(JSON.stringify(s.draft)) : s.stepSnapshot,
        };
      }),
    restoreStepSnapshot: () => {
      let ok = false;
      setState((s) => {
        if (!s.stepSnapshot) return s;
        ok = true;
        return { ...s, draft: JSON.parse(JSON.stringify(s.stepSnapshot)), currentRoomId: "" };
      });
      return ok || !!state.stepSnapshot;
    },

    login: (id, remember) =>
      setState((s) => ({ ...s, loggedIn: true, savedId: remember ? id : "", screen: "home" })),
    logout: () => setState((s) => ({ ...s, loggedIn: false, screen: "login" })),
    updateDraft: (patch) => setState((s) => ({ ...s, draft: { ...s.draft, ...patch } })),
    resetDraft: () => setState((s) => ({ ...s, draft: newEstimate(), currentRoomId: "" })),
    saveDraft: () =>
      setState((s) => {
        const { total } = calcEstimate(s.draft);
        const finalized: Estimate = { ...s.draft, total, status: "완료" };
        const idx = s.estimates.findIndex((e) => e.id === finalized.id);
        const estimates =
          idx >= 0
            ? s.estimates.map((e) => (e.id === finalized.id ? finalized : e))
            : [finalized, ...s.estimates];
        return { ...s, estimates, draft: finalized };
      }),
    deleteEstimate: (id) =>
      setState((s) => ({ ...s, estimates: s.estimates.filter((e) => e.id !== id) })),
    loadEstimate: (id) =>
      setState((s) => {
        const e = s.estimates.find((x) => x.id === id);
        return e ? { ...s, draft: { ...e }, screen: "result" } : s;
      }),
    setCurrentRoom: (id) => setState((s) => ({ ...s, currentRoomId: id })),
  };

  return <AppCtx.Provider value={ctx}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

export function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
export function won(n: number) {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return v.toLocaleString("ko-KR") + "원";
}

/** "2026-08-01" + "오전 09:00" → "2026년 8월 1일 오전 09:00" */
export function formatMoveDateTime(date: string, time: string): string {
  if (!date) return "이사 날짜 미입력";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return `${date} ${time ?? ""}`.trim();
  return `${y}년 ${m}월 ${d}일${time ? ` ${time}` : ""}`;
}

/** 방별 품목 요약: 품목 종류 수와 총 수량 */
export function roomSummary(items: RoomItems): { kinds: number; count: number } {
  const values = Object.values(items || {}).filter((v) => Number(v) > 0);
  return { kinds: values.length, count: values.reduce((a, b) => a + Number(b), 0) };
}

/** localStorage에서 견적 ID로 찾기 (공유 페이지 등 Provider 외부에서도 사용) */
export function loadEstimateFromStorage(id: string): Estimate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as AppState;
    return state.estimates.find((e) => e.id === id) || null;
  } catch {
    return null;
  }
}

/** 품목 이름만으로 분류(가구/가전/주방/생활용품/잔짐)를 자동 추정 */
const CAT_KEYWORDS: { cat: string; words: string[] }[] = [
  {
    cat: "가전",
    words: [
      "냉장고",
      "김치",
      "세탁기",
      "건조기",
      "tv",
      "티비",
      "텔레비",
      "에어컨",
      "공기청정",
      "청정기",
      "컴퓨터",
      "pc",
      "모니터",
      "프린터",
      "스타일러",
      "안마의자",
      "비데",
      "보일러",
      "선풍기",
      "히터",
      "온풍기",
      "제습기",
      "가습기",
      "오디오",
      "스피커",
      "전자",
      "로봇청소기",
    ],
  },
  {
    cat: "주방",
    words: [
      "전자레인지",
      "레인지",
      "정수기",
      "밥솥",
      "가스",
      "인덕션",
      "식기",
      "오븐",
      "에어프라이",
      "커피",
      "냄비",
      "그릇",
      "주방",
      "싱크",
    ],
  },
  {
    cat: "가구",
    words: [
      "침대",
      "장롱",
      "옷장",
      "붙박이",
      "소파",
      "식탁",
      "의자",
      "책상",
      "책장",
      "화장대",
      "서랍",
      "선반",
      "수납장",
      "테이블",
      "협탁",
      "침구장",
      "피아노",
      "금고",
      "진열장",
      "거울",
      "행거",
    ],
  },
  {
    cat: "생활용품",
    words: [
      "청소기",
      "건조대",
      "공구",
      "화분",
      "자전거",
      "유모차",
      "운동",
      "런닝",
      "골프",
      "캠핑",
      "빨래",
      "다리미",
      "쓰레기",
      "우산",
      "신발",
      "텐트",
    ],
  },
  {
    cat: "잔짐",
    words: ["박스", "바구니", "가방", "상자", "잡화", "기타", "짐"],
  },
];

export function guessCategory(name: string): string {
  const n = name.toLowerCase().replace(/\s/g, "");
  for (const { cat, words } of CAT_KEYWORDS) {
    if (words.some((w) => n.includes(w))) return cat;
  }
  return "잔짐";
}
