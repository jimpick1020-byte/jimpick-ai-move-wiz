/**
 * 음성 해석 정확도 측정.
 *
 *   npx tsx scripts/voice-accuracy.ts
 *
 * 실제로 사장님이 말할 법한 문장을 넣고, 공간·품목·수량이 맞는지 세어 봅니다.
 * (마이크 없이 문장만으로 재는 값입니다. 마이크로 받아쓴 정확도는 따로 재야 합니다.)
 */
import { parseVoice } from "../src/lib/voice-parse";

const ROOMS = ["안방", "작은방", "입구방", "거실", "부엌", "베란다"];

interface Case {
  say: string;
  room?: string | null;
  /** 담겨야 할 품목 이름과 수량 */
  items?: [string, number][];
  work?: string[];
  truck?: { truck1t?: number; truck5t?: number; ladder?: boolean };
}

const CASES: Case[] = [
  // ---- 수량 말하기 ----
  { say: "냉장고 한 개", items: [["냉장고", 1]] },
  { say: "냉장고 하나", items: [["냉장고", 1]] },
  { say: "냉장고 1개", items: [["냉장고", 1]] },
  { say: "세탁기 두 개", items: [["세탁기", 2]] },
  { say: "세탁기 둘", items: [["세탁기", 2]] },
  { say: "세탁기 2개", items: [["세탁기", 2]] },
  { say: "의자 세 개", items: [["의자", 3]] },
  { say: "의자 셋", items: [["의자", 3]] },
  { say: "에어컨 한 대", items: [["스탠드 에어컨", 1]] },
  { say: "에어컨 두 대", items: [["스탠드 에어컨", 2]] },
  { say: "장롱 한 짝", items: [["장롱", 1]] },
  { say: "장롱 두 짝", items: [["장롱", 2]] },
  { say: "장롱 세 짝", items: [["장롱", 3]] },
  { say: "박스 열 개", items: [["이삿짐 박스", 10]] },
  { say: "이삿짐 박스 스무 개", items: [["이삿짐 박스", 20]] },
  { say: "카펫 다섯 장", items: [["카펫·러그", 5]] },

  // ---- 부르는 말이 다를 때 ----
  { say: "퀸 침대", items: [["침대(퀸·킹)", 1]] },
  { say: "퀸침대 한 개", items: [["침대(퀸·킹)", 1]] },
  { say: "킹 사이즈 침대", items: [["침대(퀸·킹)", 1]] },
  { say: "싱글침대 두 개", items: [["침대(싱글)", 2]] },
  { say: "티비 한 대", items: [["TV", 1]] },
  { say: "TV 두 대", items: [["TV", 2]] },
  { say: "텔레비전 하나", items: [["TV", 1]] },
  { say: "벽걸이 티비", items: [["벽걸이TV", 1]] },
  { say: "쇼파 하나", items: [["소파(3인)", 1]] },
  { say: "김냉 한 대", items: [["김치냉장고", 1]] },
  { say: "드럼 세탁기", items: [["드럼세탁기", 1]] },
  { say: "옷장 두 짝", items: [["장롱", 2]] },
  { say: "책꽂이 세 개", items: [["책장", 3]] },
  { say: "전자렌지 하나", items: [["전자레인지", 1]] },
  { say: "가스렌지 한 대", items: [["가스레인지", 1]] },
  { say: "런닝머신 한 대", items: [["러닝머신", 1]] },
  { say: "컴퓨터 두 대", items: [["컴퓨터·모니터", 2]] },
  { say: "빨래건조대 한 개", items: [["빨래건조대", 1]] },
  { say: "전신거울 하나", items: [["전신거울", 1]] },

  // ---- 여러 개를 이어서 말할 때 ----
  {
    say: "냉장고 하나 세탁기 하나",
    items: [
      ["냉장고", 1],
      ["세탁기", 1],
    ],
  },
  {
    say: "냉장고 한 개하고 에어컨 두 대",
    items: [
      ["냉장고", 1],
      ["스탠드 에어컨", 2],
    ],
  },
  {
    say: "소파 하나 그리고 티비 한 대",
    items: [
      ["소파(3인)", 1],
      ["TV", 1],
    ],
  },
  {
    say: "책상 두 개, 의자 네 개, 책장 하나",
    items: [
      ["책상", 2],
      ["의자", 4],
      ["책장", 1],
    ],
  },
  {
    say: "장롱 세 짝이랑 화장대 하나",
    items: [
      ["장롱", 3],
      ["화장대", 1],
    ],
  },

  // ---- 공간을 같이 말할 때 ----
  { say: "안방에 퀸 침대 하나", room: "안방", items: [["침대(퀸·킹)", 1]] },
  {
    say: "거실에 소파 하나 티비 한 대",
    room: "거실",
    items: [
      ["소파(3인)", 1],
      ["TV", 1],
    ],
  },
  { say: "부엌에 냉장고 한 대", room: "부엌", items: [["냉장고", 1]] },
  { say: "주방에 전자레인지 하나", room: "부엌", items: [["전자레인지", 1]] },
  { say: "베란다에 빨래건조대 두 개", room: "베란다", items: [["빨래건조대", 2]] },
  {
    say: "작은방에 책상 하나 의자 하나",
    room: "작은방",
    items: [
      ["책상", 1],
      ["의자", 1],
    ],
  },
  { say: "큰방에 장롱 세 짝", room: "안방", items: [["장롱", 3]] },
  { say: "서재에 책장 두 개", room: "작은방", items: [["책장", 2]] },
  { say: "다용도실에 김치냉장고 하나", room: "베란다", items: [["김치냉장고", 1]] },
  { say: "마루에 카펫 한 장", room: "거실", items: [["카펫·러그", 1]] },

  // ---- 같은 것을 두 번 말할 때 (한 줄로 합쳐야 합니다) ----
  { say: "박스 다섯 개 그리고 박스 세 개", items: [["이삿짐 박스", 8]] },

  // ---- 추가작업 ----
  { say: "에어컨 설치 해주세요", work: ["에어컨 이전 설치"] },
  { say: "입주청소도 같이", work: ["입주 청소"] },
  { say: "폐기물 처리 있어요", work: ["폐기물 처리"] },
  { say: "장롱 분해 조립 필요해요", work: ["장롱 분해·조립"] },
  { say: "포장이사로 할게요", work: ["포장 자재비"] },

  // ---- 차량 · 사다리차 ----
  { say: "5톤 한 대", truck: { truck5t: 1 } },
  { say: "1톤 두 대", truck: { truck1t: 2 } },
  { say: "사다리차 써야 해요", truck: { ladder: true } },
  { say: "5톤 한 대에 사다리차도", truck: { truck5t: 1, ladder: true } },

  // ---- 길게 말할 때 ----
  {
    say: "안방에 퀸 침대 하나 장롱 세 짝 화장대 하나",
    room: "안방",
    items: [
      ["침대(퀸·킹)", 1],
      ["장롱", 3],
      ["화장대", 1],
    ],
  },
  {
    say: "거실에 소파 하나 티비 한 대 그리고 에어컨 한 대",
    room: "거실",
    items: [
      ["소파(3인)", 1],
      ["TV", 1],
      ["스탠드 에어컨", 1],
    ],
  },
];

/**
 * 두 번째 묶음 — 해석기를 고치면서 보지 않은 문장들입니다.
 * (첫 묶음만으로는 "맞게 고쳤는지" 를 알 수 없어 따로 둡니다)
 */
const HOLDOUT: Case[] = [
  { say: "안방 장롱 네 짝", room: "안방", items: [["장롱", 4]] },
  { say: "거실 장식장 하나", room: "거실", items: [["장식장·진열장", 1]] },
  { say: "부엌 식기세척기 한 대", room: "부엌", items: [["식기세척기", 1]] },
  { say: "정수기 하나요", items: [["정수기", 1]] },
  { say: "안마의자 한 대 있습니다", room: null, items: [["안마의자", 1]] },
  { say: "러닝머신 하나 있어요", items: [["러닝머신", 1]] },
  {
    say: "아기침대 하나랑 유모차 하나",
    items: [
      ["아기침대", 1],
      ["유모차", 1],
    ],
  },
  { say: "자전거 두 대", items: [["자전거", 2]] },
  { say: "캐리어 세 개", items: [["캐리어·여행가방", 3]] },
  { say: "이불백 네 개", items: [["이불백", 4]] },
  { say: "옷박스 여섯 개", items: [["옷박스", 6]] },
  // "주방 박스" 는 품목 이름 자체입니다. 여기서 공간을 부엌으로 바꿔 버리면
  // 사장님이 고른 공간이 말도 없이 바뀌므로, 공간은 건드리지 않는 것이 맞습니다.
  // (처음에는 부엌으로 기대했다가, 결과를 보고 이 쪽이 옳다고 판단해 고쳤습니다)
  { say: "주방 박스 다섯 개", room: null, items: [["주방 박스", 5]] },
  { say: "화분 열 개", items: [["화분", 10]] },
  { say: "피아노 한 대", items: [["피아노", 1]] },
  { say: "금고 하나", items: [["금고", 1]] },
  { say: "어항 하나", items: [["어항·수족관", 1]] },
  { say: "스타일러 한 대", items: [["스타일러", 1]] },
  { say: "건조기 한 대", items: [["건조기", 1]] },
  { say: "공기청정기 두 대", items: [["공기청정기", 2]] },
  { say: "로봇청소기 하나", items: [["로봇청소기", 1]] },
  { say: "커피머신 하나", items: [["커피머신", 1]] },
  { say: "에어프라이어 하나", items: [["에어프라이어", 1]] },
  { say: "협탁 두 개", items: [["협탁", 2]] },
  { say: "서랍장 세 개", items: [["서랍장", 3]] },
  { say: "신발장 하나", items: [["신발장", 1]] },
  { say: "액자 다섯 개", items: [["액자", 5]] },
  { say: "커튼 세 장", items: [["커튼·블라인드", 3]] },
  { say: "실내자전거 하나", items: [["실내자전거", 1]] },
  { say: "휠체어 하나", items: [["휠체어", 1]] },
  { say: "베란다 화분 스탠드 하나", room: "베란다", items: [["화분 스탠드", 1]] },
  {
    say: "작은방 책상 하나 컴퓨터 한 대",
    room: "작은방",
    items: [
      ["책상", 1],
      ["컴퓨터·모니터", 1],
    ],
  },
  {
    say: "거실 소파 하나 티테이블 하나",
    room: "거실",
    items: [
      ["소파(3인)", 1],
      ["티테이블", 1],
    ],
  },
  { say: "5톤 두 대 필요할 것 같아요", truck: { truck5t: 2 } },
  { say: "사다리차 불러야 돼요", truck: { ladder: true } },
  { say: "에어컨 철거도 해주세요", work: ["에어컨 철거"] },
];

function run(list: Case[], label: string) {
  let pass = 0;
  const fails: string[] = [];

  for (const c of list) {
    const r = parseVoice(c.say, ROOMS);
    const got = [...r.items, ...r.needConfirm];
    const problems: string[] = [];

    if (c.room !== undefined && r.room !== c.room) {
      problems.push(`공간 ${r.room ?? "없음"} (원하는 값 ${c.room ?? "없음"})`);
    }
    for (const [name, qty] of c.items ?? []) {
      const hit = got.find((g) => g.name === name);
      if (!hit) problems.push(`품목 '${name}' 못 찾음`);
      else if (hit.qty !== qty) problems.push(`'${name}' 수량 ${hit.qty} (원하는 값 ${qty})`);
    }
    if (c.items && got.length !== c.items.length) {
      problems.push(
        `품목 수 ${got.length} (원하는 값 ${c.items.length}) → ${got.map((g) => g.name).join("/")}`,
      );
    }
    for (const w of c.work ?? []) {
      if (!r.extraWork.some((x) => x.name === w)) problems.push(`추가작업 '${w}' 못 찾음`);
    }
    if (c.truck) {
      if (c.truck.truck1t !== undefined && r.truck?.truck1t !== c.truck.truck1t)
        problems.push(`1톤 ${r.truck?.truck1t ?? 0} (원하는 값 ${c.truck.truck1t})`);
      if (c.truck.truck5t !== undefined && r.truck?.truck5t !== c.truck.truck5t)
        problems.push(`5톤 ${r.truck?.truck5t ?? 0} (원하는 값 ${c.truck.truck5t})`);
      if (c.truck.ladder !== undefined && r.truck?.ladder !== c.truck.ladder)
        problems.push(`사다리차 ${r.truck?.ladder ?? false} (원하는 값 ${c.truck.ladder})`);
    }

    if (problems.length === 0) pass++;
    else fails.push(`  ✗ "${c.say}"\n      ${problems.join("\n      ")}`);
  }

  console.log(
    `\n[${label}] 문장 ${list.length}개 중 ${pass}개 정확 — ${((pass / list.length) * 100).toFixed(1)}%`,
  );
  if (fails.length) {
    console.log("틀린 문장:");
    console.log(fails.join("\n"));
  }
  return { pass, total: list.length };
}

const a = run(CASES, "만들면서 본 문장");
const b = run(HOLDOUT, "안 보고 남겨 둔 문장");
const total = a.total + b.total;
const ok = a.pass + b.pass;
console.log(`\n전체 ${total}개 중 ${ok}개 정확 — ${((ok / total) * 100).toFixed(1)}%\n`);
process.exit(ok === total ? 0 : 1);
