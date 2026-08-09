/*
 * AI 부동산 블로그 — 공용 타입 / 상수 / localStorage 저장소
 */
import type { GeneratedBlog, PhotoAnalysis } from "@/lib/blog.functions";

export type TransactionType = "매매" | "전세" | "월세" | "단기" | "임대";
export const TRANSACTION_TYPES: TransactionType[] = ["매매", "전세", "월세", "단기", "임대"];

export interface Photo {
  id: string;
  dataUrl: string;
  label?: string; // AI가 파악한 공간 (거실/주방 등)
}

/** 매물 입력 정보 — 라벨을 그대로 key 로 씁니다 (AI 프롬프트/미리보기 공용) */
export interface PropertyInfo {
  아파트명: string;
  주소: string;
  "동/층": string;
  전용면적: string;
  공급면적: string;
  평수: string;
  방개수: string;
  욕실개수: string;
  매매가: string;
  전세가: string;
  월세보증금: string;
  월세: string;
  관리비: string;
  입주가능일: string;
  방향: string;
  주차: string;
  준공년도: string;
  중개사무소명: string;
  담당자명: string;
  연락처: string;
}

export const EMPTY_INFO: PropertyInfo = {
  아파트명: "",
  주소: "",
  "동/층": "",
  전용면적: "",
  공급면적: "",
  평수: "",
  방개수: "",
  욕실개수: "",
  매매가: "",
  전세가: "",
  월세보증금: "",
  월세: "",
  관리비: "",
  입주가능일: "",
  방향: "",
  주차: "",
  준공년도: "",
  중개사무소명: "",
  담당자명: "",
  연락처: "",
};

/** 거래 유형별로 화면에 노출할 가격 필드 */
export const PRICE_FIELDS: Record<TransactionType, (keyof PropertyInfo)[]> = {
  매매: ["매매가"],
  전세: ["전세가"],
  월세: ["월세보증금", "월세"],
  단기: ["월세보증금", "월세"],
  임대: ["월세보증금", "월세"],
};

/** 공통 입력 필드 순서 (가격 제외) */
export const COMMON_FIELDS: { key: keyof PropertyInfo; placeholder?: string; wide?: boolean }[] = [
  { key: "아파트명", placeholder: "예: 힐스테이트" },
  { key: "주소", placeholder: "예: 대구 수성구 ○○동", wide: true },
  { key: "동/층", placeholder: "예: 101동 15층" },
  { key: "전용면적", placeholder: "㎡" },
  { key: "공급면적", placeholder: "㎡" },
  { key: "평수", placeholder: "예: 25.7" },
  { key: "방개수", placeholder: "예: 3" },
  { key: "욕실개수", placeholder: "예: 2" },
  { key: "관리비", placeholder: "예: 12만원" },
  { key: "방향", placeholder: "예: 남향" },
  { key: "주차", placeholder: "예: 세대당 1.5대" },
  { key: "준공년도", placeholder: "예: 2019" },
];

export const CONTACT_FIELDS: { key: keyof PropertyInfo; placeholder?: string }[] = [
  { key: "중개사무소명", placeholder: "예: ○○공인중개사" },
  { key: "담당자명", placeholder: "예: 홍길동 실장" },
  { key: "연락처", placeholder: "예: 010-0000-0000" },
];

export const MOVE_IN_QUICK = ["즉시입주", "협의가능", "1개월 이내", "날짜 지정"] as const;

/** 추가 특징 선택 칩 */
export const FEATURE_GROUPS: { title: string; items: string[] }[] = [
  { title: "방향 · 층", items: ["남향", "남동향", "남서향", "동향", "고층", "중층", "저층", "로열동", "로열층"] },
  { title: "상태 · 구조", items: ["올수리", "부분수리", "신축급", "확장형", "시스템에어컨", "붙박이장", "팬트리", "드레스룸"] },
  { title: "뷰 · 환경", items: ["뷰 좋음", "일조량 좋음", "조용함", "숲세권", "공원 인접"] },
  { title: "입지 · 생활", items: ["역세권", "학세권", "생활권 좋음", "대형마트 인접", "병원 인접"] },
  { title: "기타", items: ["즉시입주", "애완동물 협의"] },
];

export const ALL_FEATURES = FEATURE_GROUPS.flatMap((g) => g.items);

/** 사진 라벨 추천 (수동 선택용) */
export const PHOTO_LABELS = [
  "거실",
  "주방",
  "안방",
  "작은방",
  "욕실",
  "베란다",
  "현관",
  "외부전경",
  "단지",
  "전망",
];

export interface StyleOption {
  id: string;
  label: string;
  desc: string;
}
export const STYLE_OPTIONS: StyleOption[] = [
  { id: "전문적인소장님", label: "전문적인 소장님", desc: "신뢰감 있는 전문 어조" },
  { id: "친절한실장님", label: "친절한 실장님", desc: "따뜻하고 다정한 안내 (기본)" },
  { id: "고급아파트홍보", label: "고급 아파트 홍보", desc: "세련된 프리미엄 어조" },
  { id: "깔끔한정보형", label: "깔끔한 정보형", desc: "핵심만 간결하게" },
  { id: "감성적인홍보형", label: "감성적인 홍보형", desc: "생활이 그려지는 묘사" },
];
export const DEFAULT_STYLE = "친절한실장님";

export const LENGTH_OPTIONS = ["짧게", "보통", "상세하게"] as const;
export const DEFAULT_LENGTH = "보통";

/** 구독 요금제 (지금은 표시만, 나중에 관리자 설정에서 변경 가능하도록 설계) */
export interface Plan {
  id: string;
  name: string;
  price: number;
  quota: string;
  features: string[];
  highlight?: boolean;
}
export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "베이직",
    price: 29000,
    quota: "월 30건 작성",
    features: ["AI 사진 분석", "블로그 글 자동 작성", "네이버 블로그용 복사"],
  },
  {
    id: "standard",
    name: "스탠다드",
    price: 49000,
    quota: "월 100건 작성",
    features: ["베이직 전체 기능", "글 스타일 5종", "이전 글 복사 작성"],
    highlight: true,
  },
  {
    id: "premium",
    name: "프리미엄",
    price: 79000,
    quota: "작성량 확대 · 무제한 정책 설정",
    features: ["스탠다드 전체 기능", "우선 처리", "관리자 사용량 설정"],
  },
];

/* ── 저장 데이터 ── */

export interface PropertyRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: "draft" | "done"; // 작성중 / 완료
  transactionType: TransactionType;
  info: PropertyInfo;
  features: string[];
  moveInMode: string; // 빠른 입주 선택
  photos: Photo[];
  coverPhotoId: string | null;
  style: string;
  length: string;
  analysis: { photos: PhotoAnalysis[]; overallStrengths: string[] } | null;
  blog: GeneratedBlog | null;
  selectedTitleIndex: number;
}

const STORAGE_KEY = "blog_records_v1";

export function loadRecords(): PropertyRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PropertyRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveRecords(records: PropertyRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* 용량 초과 등 — 무시 */
  }
}

export function upsertRecord(record: PropertyRecord): PropertyRecord[] {
  const all = loadRecords();
  const idx = all.findIndex((r) => r.id === record.id);
  const next = { ...record, updatedAt: Date.now() };
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  saveRecords(all);
  return all;
}

export function deleteRecord(id: string): PropertyRecord[] {
  const all = loadRecords().filter((r) => r.id !== id);
  saveRecords(all);
  return all;
}

export function newId(): string {
  return `p_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** 매물의 대표 사진 dataUrl */
export function coverOf(rec: Pick<PropertyRecord, "photos" | "coverPhotoId">): string | null {
  if (!rec.photos.length) return null;
  const cover = rec.photos.find((p) => p.id === rec.coverPhotoId);
  return (cover ?? rec.photos[0]).dataUrl;
}

/** 저장 레코드로 새 매물 초안을 만듭니다 (이전 글 복사) */
export function cloneAsDraft(rec: PropertyRecord): PropertyRecord {
  const now = Date.now();
  return {
    ...rec,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    status: "draft",
    // 사진/분석/결과는 새로 — 정보와 특징만 복사
    photos: [],
    coverPhotoId: null,
    analysis: null,
    blog: null,
    selectedTitleIndex: 0,
  };
}
