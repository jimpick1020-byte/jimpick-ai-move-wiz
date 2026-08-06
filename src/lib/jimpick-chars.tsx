/**
 * 짐픽 품목 캐릭터 세트 (SVG)
 *
 * 3D 이미지(item-*.png)가 없는 품목에 이름에 맞는 캐릭터를 그려 줍니다.
 * - 파일을 따로 올리지 않아도 되고, 크기를 키워도 깨지지 않습니다.
 * - 모든 캐릭터가 같은 규칙(바닥 그림자 + 눈·입·볼터치)을 써서 한 세트로 보입니다.
 *
 * 새 캐릭터를 추가하려면
 *   1) CHARS 에 `이름: () => (<>...</>)` 한 줄 추가
 *   2) ITEM_CHAR 에 품목 id 를 연결하거나, NAME_CHAR 에 검색 단어를 넣으면 끝입니다.
 */

/** 바닥 그림자 — 3D 이미지(Art3D)와 같은 느낌을 내기 위한 공통 요소 */
const Shadow = ({ rx = 17 }: { rx?: number }) => (
  <ellipse cx="32" cy="57.5" rx={rx} ry="3.2" fill="#0751D8" opacity="0.16" />
);

/** 캐릭터 얼굴 — 눈 두 개, 웃는 입, 발그레한 볼 */
const Face = ({ x = 32, y = 33, s = 1 }: { x?: number; y?: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle cx="-4.3" cy="0" r="1.7" fill="#1F2937" />
    <circle cx="4.3" cy="0" r="1.7" fill="#1F2937" />
    <path
      d="M-2.7 3.3a3.5 3.5 0 0 0 5.4 0"
      stroke="#1F2937"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="-8.4" cy="2.1" r="2.1" fill="#FB7185" opacity="0.32" />
    <circle cx="8.4" cy="2.1" r="2.1" fill="#FB7185" opacity="0.32" />
  </g>
);

/** 위에서 빛이 드는 느낌을 주는 반투명 하이라이트 */
const Gloss = ({ d }: { d: string }) => <path d={d} fill="#FFFFFF" opacity="0.28" />;

type Char = () => React.ReactElement;

// ============================================================
// 캐릭터 그림
// ============================================================
const CHARS: Record<string, Char> = {
  // ── 포장·박스류 ──────────────────────────────────────────
  /** 옷박스 — 박스 위에 티셔츠 */
  clothbox: () => (
    <>
      <Shadow />
      <path d="M14 26h36v26a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" fill="#F0B67A" />
      <path d="M14 26h36v6H14z" fill="#D99657" />
      <path d="M27 26h10v9l-5-3-5 3z" fill="#4A94FF" />
      <Face y={44} s={0.95} />
      <Gloss d="M17 32h8v20h-8z" />
    </>
  ),
  /** 대박스 */
  bigbox: () => (
    <>
      <Shadow rx={19} />
      <path d="M10 22h44v30a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3z" fill="#E9A867" />
      <path d="M10 22h44v7H10z" fill="#CE8A4C" />
      <path d="M30 22h4v7h-4z" fill="#B4763E" />
      <Face y={42} />
      <Gloss d="M14 29h7v23h-7z" />
    </>
  ),
  /** 중박스 */
  midbox: () => (
    <>
      <Shadow rx={15} />
      <path d="M16 28h32v24a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3z" fill="#EDB176" />
      <path d="M16 28h32v6H16z" fill="#D2925A" />
      <path d="M30 28h4v6h-4z" fill="#B87C43" />
      <Face y={45} s={0.9} />
      <Gloss d="M19 34h6v18h-6z" />
    </>
  ),
  /** 바구니 — 엮은 무늬 */
  basket: () => (
    <>
      <Shadow rx={16} />
      <path d="M13 29h38l-4 23a3 3 0 0 1-3 2.5H20a3 3 0 0 1-3-2.5z" fill="#E3B486" />
      <rect x="11" y="25" width="42" height="5" rx="2" fill="#C9945F" />
      <path d="M20 33v20M26 33v21M32 33v21M38 33v21M44 33v20" stroke="#C9945F" strokeWidth="1.6" />
      <path d="M15 40h34M16.5 47h31" stroke="#C9945F" strokeWidth="1.6" />
      <Face y={43} s={0.9} />
    </>
  ),
  /** 잡화 가방 — 손잡이 달린 토트백 */
  bag: () => (
    <>
      <Shadow rx={14} />
      <path d="M24 30v-4a8 8 0 0 1 16 0v4" stroke="#7C5CD6" strokeWidth="3" fill="none" />
      <path d="M15 29h34l-3 24a3 3 0 0 1-3 2.6H21a3 3 0 0 1-3-2.6z" fill="#A98BEF" />
      <path d="M15 29h34l-.6 5H15.6z" fill="#8C6BE0" />
      <Face y={43} s={0.92} />
      <Gloss d="M20 35h5l-1.4 18h-5z" />
    </>
  ),
  /** 비닐 포장 — 묶은 비닐봉지 */
  vinyl: () => (
    <>
      <Shadow rx={14} />
      <path d="M26 22l-3 5 4 2M38 22l3 5-4 2" stroke="#67C9E8" strokeWidth="2.6" fill="none" />
      <path d="M18 28h28l-2.5 24a3 3 0 0 1-3 2.6H23.5a3 3 0 0 1-3-2.6z" fill="#9BDCF2" />
      <Face y={42} s={0.92} />
      <Gloss d="M23 32h5l-1 20h-5z" />
    </>
  ),
  /** 이불 — 개어 놓은 이불과 베개 */
  blanket: () => (
    <>
      <Shadow rx={18} />
      <path
        d="M11 36h42a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V39a3 3 0 0 1 3-3z"
        fill="#F7A8C4"
      />
      <path d="M8 43h48v2H8z" fill="#E888AC" />
      <path d="M18 26h28a4 4 0 0 1 4 4v6H14v-6a4 4 0 0 1 4-4z" fill="#FFD3E2" />
      <Face y={31} s={0.9} />
    </>
  ),
  /** 의류 — 옷걸이에 걸린 셔츠 */
  clothes: () => (
    <>
      <Shadow rx={14} />
      <path d="M32 12v5" stroke="#94A3B8" strokeWidth="2" />
      <path
        d="M22 22l10-5 10 5"
        stroke="#94A3B8"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M22 22l-6 5 4 5 3-2v22a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V30l3 2 4-5-6-5-10 4z"
        fill="#5FA8FF"
      />
      <Face y={40} s={0.95} />
      <Gloss d="M25 30h4v22h-4z" />
    </>
  ),
  /** 책 — 쌓아 놓은 책 */
  books: () => (
    <>
      <Shadow rx={16} />
      <path d="M14 44h36v8H14z" fill="#F08A5D" />
      <path d="M14 44h36v2H14z" fill="#D96F42" />
      <path d="M17 35h30v9H17z" fill="#5FA8FF" />
      <path d="M17 35h30v2H17z" fill="#3C86E8" />
      <path d="M20 26h24v9H20z" fill="#67C98E" />
      <path d="M20 26h24v2H20z" fill="#46AB6E" />
      <Face y={31} s={0.82} />
    </>
  ),
  /** 그릇 — 포개 놓은 그릇 */
  dishes: () => (
    <>
      <Shadow rx={16} />
      <path d="M16 46h32a0 0 0 0 1 0 0 6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" fill="#CBD5E1" />
      <path d="M18 37h28a5 5 0 0 1-5 5H23a5 5 0 0 1-5-5z" fill="#E2E8F0" />
      <ellipse cx="32" cy="37" rx="14" ry="2.6" fill="#F1F5F9" />
      <path d="M20 28h24a5 5 0 0 1-5 5H25a5 5 0 0 1-5-5z" fill="#F1F5F9" />
      <ellipse cx="32" cy="28" rx="12" ry="2.4" fill="#FFFFFF" />
      <Face y={31} s={0.78} />
    </>
  ),
  /** 냄비 — 뚜껑 달린 냄비 */
  pot: () => (
    <>
      <Shadow rx={16} />
      <path d="M12 33h6v5h-6zM46 33h6v5h-6z" fill="#94A3B8" />
      <path d="M17 31h30v18a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5z" fill="#64748B" />
      <rect x="14" y="27" width="36" height="4" rx="2" fill="#94A3B8" />
      <circle cx="32" cy="24" r="2.6" fill="#475569" />
      <Face y={42} s={0.95} />
      <Gloss d="M21 35h4v17h-4z" />
    </>
  ),
  /** 식기 — 접시 위 포크와 숟가락 */
  tableware: () => (
    <>
      <Shadow rx={16} />
      <ellipse cx="32" cy="44" rx="19" ry="9" fill="#E2E8F0" />
      <ellipse cx="32" cy="42.5" rx="14" ry="6.4" fill="#F8FAFC" />
      <path
        d="M17 18v12M20 18v12M23 18v12M20 30v18"
        stroke="#94A3B8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="45" cy="24" rx="3.6" ry="5.4" fill="#94A3B8" />
      <path d="M45 29v19" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <Face y={42} s={0.8} />
    </>
  ),
  /** 조리도구 — 통에 꽂은 뒤집개와 국자 */
  cookware: () => (
    <>
      <Shadow rx={15} />
      <rect x="24" y="14" width="7" height="14" rx="2" fill="#F0B67A" />
      <path d="M26.5 26h2v14h-2z" fill="#B0754A" />
      <path d="M38 16a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" fill="#F0B67A" />
      <path d="M40 26h2v14h-2z" fill="#B0754A" />
      <path d="M19 34h26v17a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4z" fill="#5FA8FF" />
      <Face y={45} s={0.92} />
      <Gloss d="M23 38h4v14h-4z" />
    </>
  ),
  /** 양념 — 양념통 두 개 */
  sauce: () => (
    <>
      <Shadow rx={16} />
      <rect x="17" y="20" width="9" height="4" rx="1" fill="#94A3B8" />
      <path d="M16 24h11v27a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z" fill="#EF7B6E" />
      <path d="M16 34h11v9H16z" fill="#FFE1DC" />
      <rect x="38" y="20" width="9" height="4" rx="1" fill="#94A3B8" />
      <path d="M37 24h11v27a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z" fill="#F5C451" />
      <path d="M37 34h11v9H37z" fill="#FFF3D4" />
      <Face y={38} s={0.75} />
    </>
  ),
  /** 화분 — 잎이 자란 화분 */
  plant: () => (
    <>
      <Shadow rx={15} />
      <path d="M32 34c0-9-6-14-12-15 0 9 5 14 12 15z" fill="#57C08A" />
      <path d="M32 34c0-9 6-14 12-15 0 9-5 14-12 15z" fill="#3FA872" />
      <path d="M32 36V22" stroke="#2E8F5E" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 36h26l-3 17a3 3 0 0 1-3 2.6H25a3 3 0 0 1-3-2.6z" fill="#E08A5F" />
      <rect x="17" y="33" width="30" height="5" rx="2" fill="#C4714A" />
      <Face y={46} s={0.9} />
    </>
  ),
  /** 커튼 — 봉에 걸린 커튼 */
  curtain: () => (
    <>
      <Shadow rx={18} />
      <rect x="9" y="17" width="46" height="3.4" rx="1.7" fill="#94A3B8" />
      <path d="M13 21h16c0 14-3 22-3 30H13z" fill="#F0A6B8" />
      <path d="M35 21h16v30H38c0-8-3-16-3-30z" fill="#F0A6B8" />
      <path
        d="M17 21c0 14-2 22-2 30M22 21c0 14-2 22-2 30M44 21c0 14 2 22 2 30M49 21c0 14 2 22 2 30"
        stroke="#D97F96"
        strokeWidth="1.4"
        fill="none"
      />
      <Face y={38} s={0.9} />
    </>
  ),
  /** 카펫 — 돌돌 만 카펫 */
  carpet: () => (
    <>
      <Shadow rx={18} />
      <path d="M13 30h38v20a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5z" fill="#B58FE0" />
      <ellipse cx="13" cy="40" rx="6" ry="15" fill="#9A70CF" />
      <ellipse cx="13" cy="40" rx="3" ry="8" fill="#7E56B5" />
      <path d="M22 33h26M22 39h26M22 45h26" stroke="#D5BCF0" strokeWidth="1.6" />
      <Face x={37} y={44} s={0.9} />
    </>
  ),
  /** 식기건조대 — 접시 꽂은 선반 */
  dishrack: () => (
    <>
      <Shadow rx={17} />
      <path d="M13 46h38v6a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3z" fill="#94A3B8" />
      <path
        d="M18 27v19M25 25v21M32 24v22M39 25v21M46 27v19"
        stroke="#CBD5E1"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <ellipse cx="21.5" cy="34" rx="2.4" ry="8" fill="#F1F5F9" />
      <ellipse cx="28.5" cy="33" rx="2.4" ry="9" fill="#E2E8F0" />
      <ellipse cx="35.5" cy="33" rx="2.4" ry="9" fill="#F1F5F9" />
      <ellipse cx="42.5" cy="34" rx="2.4" ry="8" fill="#E2E8F0" />
      <Face y={51} s={0.75} />
    </>
  ),
  /** 빨래건조대 — 빨래 널린 건조대 */
  drying: () => (
    <>
      <Shadow rx={18} />
      <path d="M14 24h36" stroke="#94A3B8" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M14 31h36M14 38h36" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 24v30M48 24v30" stroke="#94A3B8" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="21" y="24" width="9" height="11" rx="1" fill="#7FC3F5" />
      <rect x="35" y="24" width="9" height="14" rx="1" fill="#FFD37E" />
      <Face y={47} s={0.85} />
    </>
  ),
  /** 공구함 — 손잡이 달린 공구통 */
  toolbox: () => (
    <>
      <Shadow rx={17} />
      <rect
        x="25"
        y="24"
        width="14"
        height="5"
        rx="2"
        fill="none"
        stroke="#64748B"
        strokeWidth="2.6"
      />
      <rect x="13" y="29" width="38" height="8" rx="2" fill="#EF6B5E" />
      <path d="M13 37h38v15a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3z" fill="#DC5648" />
      <rect x="27" y="37" width="10" height="5" rx="1" fill="#94A3B8" />
      <Face y={47} s={0.95} />
      <Gloss d="M17 31h5v22h-5z" />
    </>
  ),
  /** 운동기구 — 아령 */
  exercise: () => (
    <>
      <Shadow rx={17} />
      <path d="M22 32h20v9H22z" fill="#64748B" />
      <path d="M12 26h8v21h-8zM44 26h8v21h-8z" fill="#334155" />
      <path d="M20 29h4v15h-4zM40 29h4v15h-4z" fill="#475569" />
      <Face y={36} s={0.85} />
    </>
  ),
  /** 캠핑용품 — 텐트와 모닥불 */
  camping: () => (
    <>
      <Shadow rx={19} />
      <path d="M26 20l18 32H8z" fill="#4FB07A" />
      <path d="M26 20l6 0 18 32H44z" fill="#3E9366" />
      <path d="M26 26l9 26h-18z" fill="#2F7A52" />
      <path d="M26 30l5 22h-10z" fill="#1F5C3C" />
      <path
        d="M52 52c-3 0-5-2-5-4.4 0-2.6 2.6-3.6 2.6-6.6 2.6 1.4 4 3.6 4 6 0 1-.4 1.8-.8 2.4.8-.4 1.4-1.4 1.6-2.4 1 1.2 1.6 2.6 1.6 4 0 2.2-2 4-4 4z"
        fill="#FB923C"
      />
      <path
        d="M52 52c-1.6 0-2.6-1-2.6-2.2 0-1.6 1.6-2 1.6-3.8 1.6 1 2.6 2.4 2.6 4 0 1.2-.8 2-1.6 2z"
        fill="#FDE047"
      />
      <Face x={26} y={40} s={0.9} />
    </>
  ),
  /** 유아용품 — 곰인형 */
  baby: () => (
    <>
      <Shadow rx={15} />
      <circle cx="20" cy="20" r="6" fill="#D9A273" />
      <circle cx="44" cy="20" r="6" fill="#D9A273" />
      <circle cx="20" cy="20" r="3" fill="#F0C9A5" />
      <circle cx="44" cy="20" r="3" fill="#F0C9A5" />
      <path d="M16 44h32v6a5 5 0 0 1-5 5H21a5 5 0 0 1-5-5z" fill="#C98F5F" />
      <circle cx="32" cy="30" r="14" fill="#E7B183" />
      <ellipse cx="32" cy="35" rx="6.6" ry="5" fill="#F7DCC2" />
      <circle cx="32" cy="32.6" r="1.9" fill="#5B3B22" />
      <circle cx="26.6" cy="27" r="1.9" fill="#3B2515" />
      <circle cx="37.4" cy="27" r="1.9" fill="#3B2515" />
      <path
        d="M29.6 36.4a3 3 0 0 0 4.8 0"
        stroke="#5B3B22"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="22.6" cy="32" r="2.2" fill="#FB7185" opacity="0.35" />
      <circle cx="41.4" cy="32" r="2.2" fill="#FB7185" opacity="0.35" />
    </>
  ),

  // ── 특수품목 ─────────────────────────────────────────────
  /** 안마의자 */
  massageChair: () => (
    <>
      <Shadow rx={18} />
      <path d="M12 26a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v20H12z" fill="#475569" />
      <path d="M12 44h34a6 6 0 0 1 6 6v3H12z" fill="#64748B" />
      <rect x="46" y="46" width="8" height="9" rx="2" fill="#334155" />
      <rect x="10" y="46" width="8" height="9" rx="2" fill="#334155" />
      <rect x="16" y="28" width="8" height="14" rx="2" fill="#94A3B8" />
      <circle cx="49" cy="38" r="3.4" fill="#F59E0B" />
      <Face x={36} y={38} s={0.85} />
    </>
  ),
  /** 금고 — 다이얼 달린 금고 */
  safe: () => (
    <>
      <Shadow rx={17} />
      <path d="M12 16h40v39a1 1 0 0 1-1 1H13a1 1 0 0 1-1-1z" fill="#475569" />
      <rect x="17" y="21" width="30" height="29" rx="2" fill="#64748B" />
      <circle cx="32" cy="35" r="7.6" fill="#334155" />
      <circle cx="32" cy="35" r="4.4" fill="#94A3B8" />
      <path
        d="M32 27v-3M32 46v-3M40 35h3M21 35h3"
        stroke="#CBD5E1"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Face y={26} s={0.72} />
    </>
  ),
  /** 모션 침대 — 머리쪽이 올라간 침대 */
  motionBed: () => (
    <>
      <Shadow rx={19} />
      <rect x="8" y="42" width="48" height="8" rx="2" fill="#8AA0BC" />
      <path d="M10 50h4v6h-4zM50 50h4v6h-4z" fill="#5D7290" />
      <path d="M12 34l16-8v16H12z" fill="#DCE6F5" />
      <path d="M28 36h26v6H28z" fill="#EDF3FC" />
      <path d="M15 30l9-4.5v6l-9 4.5z" fill="#F7A8C4" />
      <rect x="40" y="24" width="5" height="3" rx="1.5" fill="#34C759" />
      <Face x={40} y={38} s={0.8} />
    </>
  ),
  /** 돌침대 · 흙침대 — 두꺼운 상판 */
  stoneBed: () => (
    <>
      <Shadow rx={19} />
      <rect x="8" y="44" width="48" height="8" rx="2" fill="#8A7A6B" />
      <path d="M10 52h4v4h-4zM50 52h4v4h-4z" fill="#655749" />
      <rect x="8" y="32" width="48" height="12" rx="2" fill="#B9A894" />
      <path d="M14 35h9v6h-9zM27 35h9v6h-9zM40 35h9v6h-9z" fill="#CFC1B0" />
      <rect x="12" y="24" width="14" height="8" rx="3" fill="#EFE6DA" />
      <Face x={40} y={38} s={0.8} />
    </>
  ),
  /** 대리석 · 유리 식탁 */
  marbleTable: () => (
    <>
      <Shadow rx={19} />
      <rect x="8" y="28" width="48" height="7" rx="2" fill="#E8EDF5" />
      <rect x="8" y="28" width="48" height="3" rx="1.5" fill="#FFFFFF" />
      <path
        d="M16 30c4 1.4 8-1 12 .6M32 32.6c5-1.6 9 1 14-.6"
        stroke="#B9C6DA"
        strokeWidth="1.2"
        fill="none"
      />
      <path d="M14 35h4v20h-4zM46 35h4v20h-4z" fill="#94A3B8" />
      <path d="M18 44h28v3H18z" fill="#B4C1D4" />
      <Face y={49} s={0.85} />
    </>
  ),
  /** 수족관 — 물고기 있는 어항 */
  aquarium: () => (
    <>
      <Shadow rx={18} />
      <path d="M10 20h44v32a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3z" fill="#BFE6F7" />
      <path d="M10 26h44v26a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3z" fill="#7FD0EE" />
      <path d="M10 47h44v5a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3z" fill="#D6BE95" />
      <path d="M22 47c0-6 3-9 3-9s3 3 3 9z" fill="#4FB07A" />
      <path d="M38 47c0-8 3-11 3-11s3 3 3 11z" fill="#3E9366" />
      <path d="M36 33l7-4v8z" fill="#FB923C" />
      <ellipse cx="33" cy="33" rx="5" ry="4" fill="#F97316" />
      <circle cx="30.6" cy="32" r="1.2" fill="#1F2937" />
      <circle cx="19" cy="30" r="2" fill="#FFFFFF" opacity="0.6" />
      <circle cx="23" cy="24" r="1.4" fill="#FFFFFF" opacity="0.6" />
      <rect x="8" y="17" width="48" height="4" rx="2" fill="#64748B" />
    </>
  ),
  /** 런닝머신 */
  treadmill: () => (
    <>
      <Shadow rx={19} />
      <path d="M14 46h36a4 4 0 0 1 4 4v3H10v-3a4 4 0 0 1 4-4z" fill="#475569" />
      <path d="M16 48h32v3H16z" fill="#1F2937" />
      <path d="M22 46L34 22" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
      <rect x="30" y="22" width="16" height="10" rx="2" fill="#94A3B8" />
      <path d="M33 25h10v4H33z" fill="#34C759" />
      <path d="M28 20h20" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
      <Face x={40} y={41} s={0.8} />
    </>
  ),
  /** 헬스기구 — 원판 달린 바벨 거치대 */
  gymEquip: () => (
    <>
      <Shadow rx={19} />
      <path d="M14 22v32M50 22v32" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
      <path d="M10 52h12v3H10zM42 52h12v3H42z" fill="#334155" />
      <rect x="12" y="30" width="40" height="3.4" rx="1.7" fill="#94A3B8" />
      <circle cx="20" cy="31.7" r="7" fill="#1F2937" />
      <circle cx="44" cy="31.7" r="7" fill="#1F2937" />
      <circle cx="20" cy="31.7" r="2.6" fill="#64748B" />
      <circle cx="44" cy="31.7" r="2.6" fill="#64748B" />
      <Face y={45} s={0.85} />
    </>
  ),
  /** 복사기 */
  copier: () => (
    <>
      <Shadow rx={18} />
      <path d="M13 32h38v22a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2z" fill="#64748B" />
      <rect x="15" y="18" width="34" height="12" rx="2" fill="#94A3B8" />
      <rect x="20" y="14" width="24" height="4" rx="1.5" fill="#CBD5E1" />
      <rect x="18" y="36" width="12" height="5" rx="1.5" fill="#34C759" />
      <rect x="34" y="36" width="12" height="3" rx="1.5" fill="#475569" />
      <rect x="20" y="46" width="24" height="9" rx="1.5" fill="#475569" />
      <path d="M26 30h12v4H26z" fill="#F8FAFC" />
      <Face x={38} y={49} s={0.72} />
    </>
  ),

  // ── 3D 가 없는 가전 ──────────────────────────────────────
  /** 로봇청소기 */
  robotVacuum: () => (
    <>
      <Shadow rx={17} />
      <ellipse cx="32" cy="42" rx="21" ry="12" fill="#475569" />
      <ellipse cx="32" cy="39" rx="21" ry="12" fill="#94A3B8" />
      <ellipse cx="32" cy="38" rx="15" ry="8" fill="#CBD5E1" />
      <circle cx="32" cy="30" r="3" fill="#34C759" />
      <Face y={38} s={0.9} />
    </>
  ),
  /** 커피머신 */
  coffee: () => (
    <>
      <Shadow rx={15} />
      <rect x="16" y="14" width="32" height="14" rx="3" fill="#5B4636" />
      <path d="M16 46h32v8a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2z" fill="#3F3025" />
      <path d="M20 28h6v18h-6z" fill="#5B4636" />
      <rect x="28" y="32" width="16" height="3" rx="1.5" fill="#8B6A4F" />
      <rect x="30" y="38" width="13" height="8" rx="2" fill="#E8EDF5" />
      <path d="M31 41h11v5H31z" fill="#8B5E3C" />
      <path d="M43 39h4a3 3 0 0 1 0 6h-4z" fill="none" stroke="#E8EDF5" strokeWidth="1.8" />
      <Face x={36} y={22} s={0.8} />
    </>
  ),
  /** 밥솥 */
  riceCooker: () => (
    <>
      <Shadow rx={16} />
      <path d="M14 30h36v20a5 5 0 0 1-5 5H19a5 5 0 0 1-5-5z" fill="#E2E8F0" />
      <rect x="13" y="24" width="38" height="7" rx="3" fill="#F8FAFC" />
      <rect x="24" y="20" width="16" height="4" rx="2" fill="#CBD5E1" />
      <rect x="21" y="36" width="22" height="9" rx="2" fill="#475569" />
      <path d="M24 39h9v3h-9z" fill="#34C759" />
      <Face y={50} s={0.75} />
    </>
  ),
  /** 에어프라이어 */
  airfryer: () => (
    <>
      <Shadow rx={15} />
      <path d="M17 16h30v34a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5z" fill="#3F4A5A" />
      <path d="M21 34h22v18a3 3 0 0 1-3 3H24a3 3 0 0 1-3-3z" fill="#64748B" />
      <rect x="26" y="44" width="12" height="3" rx="1.5" fill="#94A3B8" />
      <circle cx="26" cy="25" r="3.4" fill="#F59E0B" />
      <circle cx="38" cy="25" r="3.4" fill="#CBD5E1" />
      <Face y={26} s={0.6} x={32} />
    </>
  ),
  /** 선풍기 */
  fan: () => (
    <>
      <Shadow rx={14} />
      <path d="M28 44h8v10h-8z" fill="#94A3B8" />
      <ellipse cx="32" cy="55" rx="12" ry="3.4" fill="#64748B" />
      <circle cx="32" cy="28" r="17" fill="#DCE6F5" />
      <circle cx="32" cy="28" r="17" fill="none" stroke="#94A3B8" strokeWidth="2" />
      <path d="M32 28c0-8 4-11 9-9-1 6-4 9-9 9z" fill="#7FC3F5" />
      <path d="M32 28c7 4 8 8 5 12-5-3-6-7-5-12z" fill="#5FA8FF" />
      <path d="M32 28c-7 4-13 2-14-3 5-3 11-2 14 3z" fill="#7FC3F5" />
      <circle cx="32" cy="28" r="3.4" fill="#475569" />
      <Face y={40} s={0.6} />
    </>
  ),
  /** 신발장 */
  shoeRack: () => (
    <>
      <Shadow rx={16} />
      <path d="M16 14h32v41a1 1 0 0 1-1 1H17a1 1 0 0 1-1-1z" fill="#D9A97C" />
      <path d="M19 18h26v10H19zM19 31h26v10H19zM19 44h26v9H19z" fill="#F2DCC2" />
      <path d="M22 24h8c1 0 2 1 2 2h-10z" fill="#8B6A4F" />
      <path d="M34 24h8c1 0 2 1 2 2H34z" fill="#8B6A4F" />
      <path d="M22 37h8c1 0 2 1 2 2H22z" fill="#5FA8FF" />
      <Face y={48} s={0.75} />
    </>
  ),
  /** 행거 */
  hanger: () => (
    <>
      <Shadow rx={18} />
      <path d="M12 22h40" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 22v32M48 22v32" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      <path d="M10 54h12M42 54h12" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 22v4M32 22v4M40 22v4" stroke="#64748B" strokeWidth="1.6" />
      <path d="M20 26h8l3 5-3 14h-8l-3-14z" fill="#5FA8FF" />
      <path d="M36 26h8l3 5-3 16h-8l-3-16z" fill="#F7A8C4" />
      <Face y={38} s={0.7} />
    </>
  ),
  /** 프린터 */
  printer: () => (
    <>
      <Shadow rx={17} />
      <rect x="22" y="16" width="20" height="10" rx="1.5" fill="#F8FAFC" />
      <path d="M13 26h38v18a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3z" fill="#64748B" />
      <rect x="20" y="44" width="24" height="11" rx="1.5" fill="#F1F5F9" />
      <rect x="18" y="31" width="9" height="4" rx="1.5" fill="#34C759" />
      <rect x="32" y="31" width="14" height="3" rx="1.5" fill="#94A3B8" />
      <Face y={38} s={0.7} x={39} />
    </>
  ),
  /** 비데 */
  bidet: () => (
    <>
      <Shadow rx={16} />
      <rect x="20" y="14" width="20" height="14" rx="3" fill="#E8EDF5" />
      <path d="M18 28h28v10a5 5 0 0 1-5 5H23a5 5 0 0 1-5-5z" fill="#F8FAFC" />
      <ellipse cx="32" cy="46" rx="13" ry="8" fill="#F8FAFC" />
      <ellipse cx="32" cy="46" rx="8" ry="4.4" fill="#DCE6F5" />
      <rect x="42" y="30" width="8" height="7" rx="2" fill="#CBD5E1" />
      <circle cx="46" cy="33.5" r="1.6" fill="#34C759" />
      <Face y={35} s={0.72} />
    </>
  ),

  // ── 옵션 · 작업 ──────────────────────────────────────────
  /** 에어컨 설치·철거 — 에어컨 + 스패너 */
  acWork: () => (
    <>
      <Shadow rx={17} />
      <path d="M11 20h34v16a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z" fill="#F1F5F9" />
      <path d="M11 31h34v5H14a3 3 0 0 1-3-3z" fill="#DCE6F5" />
      <rect x="15" y="24" width="20" height="3" rx="1.5" fill="#BFD4FF" />
      <path
        d="M18 42c1 3 3 4 5 3M28 42c1 3 3 4 5 3"
        stroke="#7FC3F5"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M52 30a6 6 0 0 0-8 6l-9 9 4 4 9-9a6 6 0 0 0 6-8l-4 4-3-3z" fill="#F59E0B" />
      <Face x={28} y={27} s={0.72} />
    </>
  ),
  /** 세탁기 설치 — 세탁기 + 스패너 */
  washerWork: () => (
    <>
      <Shadow rx={16} />
      <path d="M14 14h30v40a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2z" fill="#F1F5F9" />
      <rect x="14" y="14" width="30" height="8" rx="3" fill="#DCE6F5" />
      <circle cx="29" cy="36" r="12" fill="#CBD5E1" />
      <circle cx="29" cy="36" r="8.6" fill="#7FC3F5" />
      <circle cx="20" cy="18" r="1.8" fill="#94A3B8" />
      <path
        d="M55 26a5 5 0 0 0-7 5l-8 8 3.4 3.4 8-8a5 5 0 0 0 5-7l-3.4 3.4L50 27z"
        fill="#F59E0B"
      />
      <Face x={29} y={34} s={0.8} />
    </>
  ),
  /** 입주 청소 — 분무기와 거품 */
  cleaning: () => (
    <>
      <Shadow rx={16} />
      <rect x="22" y="22" width="13" height="6" rx="1.5" fill="#5FA8FF" />
      <path d="M20 28h17v25a3 3 0 0 1-3 3H23a3 3 0 0 1-3-3z" fill="#7FC3F5" />
      <path d="M20 36h17v10H20z" fill="#E0F2FE" />
      <path d="M28 22v-4h8v4" stroke="#94A3B8" strokeWidth="2.4" fill="none" />
      <path d="M36 18h6l3 4h-9z" fill="#94A3B8" />
      <circle cx="50" cy="18" r="3.4" fill="#BFE6F7" />
      <circle cx="55" cy="26" r="2.4" fill="#BFE6F7" />
      <circle cx="47" cy="28" r="2" fill="#BFE6F7" />
      <Face x={28} y={44} s={0.8} />
    </>
  ),
  /** 폐기물 처리 — 묶은 쓰레기봉투 */
  disposal: () => (
    <>
      <Shadow rx={16} />
      <path
        d="M27 16l-3 6 5 2M39 16l3 6-5 2"
        stroke="#64748B"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M18 24h28c2 8 4 16 3 24a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4c-1-8 1-16 3-24z"
        fill="#64748B"
      />
      <path d="M22 30h4c-1 7-2 14-1.6 20H20c-.6-6 .6-13 2-20z" fill="#94A3B8" opacity="0.5" />
      <Face y={42} s={0.95} />
    </>
  ),
  /** 장롱 분해·조립 — 가구 + 드라이버 */
  assembly: () => (
    <>
      <Shadow rx={17} />
      <path d="M13 14h28v41a1 1 0 0 1-1 1H14a1 1 0 0 1-1-1z" fill="#D9A97C" />
      <path d="M27 14v42" stroke="#B0754A" strokeWidth="1.8" />
      <circle cx="24" cy="35" r="1.8" fill="#8B6A4F" />
      <circle cx="30" cy="35" r="1.8" fill="#8B6A4F" />
      <path d="M52 20l-4 4 3 3 4-4z" fill="#F59E0B" />
      <path d="M48 24l-9 9 3 3 9-9z" fill="#94A3B8" />
      <path d="M39 33l-4 6 6-4z" fill="#64748B" />
      <Face x={20} y={24} s={0.8} />
    </>
  ),
  /** 포장 자재비 — 테이프와 뽁뽁이 */
  packing: () => (
    <>
      <Shadow rx={17} />
      <path d="M12 28h24v26a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2z" fill="#BFE6F7" />
      <circle cx="18" cy="34" r="1.8" fill="#8ACFEA" />
      <circle cx="25" cy="34" r="1.8" fill="#8ACFEA" />
      <circle cx="32" cy="34" r="1.8" fill="#8ACFEA" />
      <circle cx="18" cy="41" r="1.8" fill="#8ACFEA" />
      <circle cx="25" cy="41" r="1.8" fill="#8ACFEA" />
      <circle cx="32" cy="41" r="1.8" fill="#8ACFEA" />
      <circle cx="18" cy="48" r="1.8" fill="#8ACFEA" />
      <circle cx="25" cy="48" r="1.8" fill="#8ACFEA" />
      <circle cx="32" cy="48" r="1.8" fill="#8ACFEA" />
      <ellipse cx="47" cy="42" rx="11" ry="11" fill="#F5C451" />
      <ellipse cx="47" cy="42" rx="4.4" ry="4.4" fill="#FFFFFF" />
      <path d="M47 31h9v22h-9z" fill="#E0AC33" opacity="0.35" />
      <Face x={47} y={40} s={0.62} />
    </>
  ),
  /** 주차 · 도로 사용료 — 라바콘 */
  parking: () => (
    <>
      <Shadow rx={17} />
      <path d="M30 16h4l11 34H19z" fill="#FB923C" />
      <path d="M25 32h14l1.6 5H23.4z" fill="#FFFFFF" />
      <path d="M22.6 40h18.8l1.6 5H21z" fill="#FFFFFF" opacity="0.75" />
      <path d="M14 50h36a2 2 0 0 1 2 2v3H12v-3a2 2 0 0 1 2-2z" fill="#EA7A22" />
      <Face y={28} s={0.72} />
    </>
  ),
  /** 기본 캐릭터 — 어디에도 안 걸릴 때 (짐 보따리) */
  generic: () => (
    <>
      <Shadow rx={16} />
      <path
        d="M26 20l-3 6 5 2M38 20l3 6-5 2"
        stroke="#4A94FF"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M16 26h32c2 8 3 16 2 24a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4c-1-8 0-16 2-24z"
        fill="#7FC3F5"
      />
      <path d="M20 32h5c-1 7-1.6 14-1.2 20H19c-.6-6-.4-13 1-20z" fill="#FFFFFF" opacity="0.35" />
      <Face y={42} s={0.95} />
    </>
  ),

  // ── 취미·레저 ────────────────────────────────────────────
  /** 자전거 */
  bicycle: () => (
    <>
      <Shadow rx={19} />
      <circle cx="16" cy="42" r="11" fill="none" stroke="#475569" strokeWidth="3" />
      <circle cx="48" cy="42" r="11" fill="none" stroke="#475569" strokeWidth="3" />
      <circle cx="16" cy="42" r="2.4" fill="#94A3B8" />
      <circle cx="48" cy="42" r="2.4" fill="#94A3B8" />
      <path
        d="M16 42l10-16h11l-5 16M26 26h12M32 42l5-16"
        stroke="#EF6B5E"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M37 26l11 16" stroke="#EF6B5E" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M22 24h7" stroke="#334155" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M35 21h7" stroke="#334155" strokeWidth="2.6" strokeLinecap="round" />
      <Face y={36} s={0.62} x={32} />
    </>
  ),
  /** 킥보드 */
  kickboard: () => (
    <>
      <Shadow rx={17} />
      <circle cx="17" cy="46" r="6" fill="#475569" />
      <circle cx="48" cy="46" r="6" fill="#475569" />
      <path d="M17 46h30" stroke="#5FA8FF" strokeWidth="4" strokeLinecap="round" />
      <path d="M47 46V18" stroke="#94A3B8" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M39 18h14" stroke="#334155" strokeWidth="3.4" strokeLinecap="round" />
      <Face x={30} y={40} s={0.7} />
    </>
  ),
  /** 골프백 */
  golf: () => (
    <>
      <Shadow rx={14} />
      <path
        d="M26 16v-4M31 14v-4M36 17v-5"
        stroke="#94A3B8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="26" cy="11" r="2.4" fill="#CBD5E1" />
      <circle cx="31" cy="9" r="2.4" fill="#E2E8F0" />
      <circle cx="36" cy="11" r="2.4" fill="#CBD5E1" />
      <path d="M20 18h24v30a7 7 0 0 1-7 7h-10a7 7 0 0 1-7-7z" fill="#3FA872" />
      <path d="M20 30h24v8H20z" fill="#FFFFFF" opacity="0.35" />
      <path d="M18 24h4v10h-4z" fill="#2E8F5E" />
      <Face y={44} s={0.88} />
    </>
  ),
  /** 스키·보드 */
  ski: () => (
    <>
      <Shadow rx={16} />
      <path d="M22 14c-3 0-4 3-4 6v28c0 3 1.6 4 4 4s4-1 4-4V20c0-3-1-6-4-6z" fill="#5FA8FF" />
      <path d="M42 14c-3 0-4 3-4 6v28c0 3 1.6 4 4 4s4-1 4-4V20c0-3-1-6-4-6z" fill="#F0A6B8" />
      <path d="M18 30h8M38 30h8" stroke="#FFFFFF" strokeWidth="2" opacity="0.7" />
      <Face x={32} y={40} s={0.72} />
    </>
  ),
  /** 유모차 */
  stroller: () => (
    <>
      <Shadow rx={17} />
      <circle cx="20" cy="47" r="5.4" fill="#334155" />
      <circle cx="45" cy="47" r="5.4" fill="#334155" />
      <path d="M18 36h30l-4 8H20z" fill="#7C5CD6" />
      <path d="M20 36c0-11 6-17 15-17v17z" fill="#A98BEF" />
      <path d="M35 19c8 0 13 6 13 17h-13z" fill="#8C6BE0" />
      <path d="M48 36l6-14" stroke="#64748B" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M52 20h6" stroke="#64748B" strokeWidth="2.6" strokeLinecap="round" />
      <Face x={31} y={30} s={0.75} />
    </>
  ),
  /** 반려동물 케이지 */
  petcage: () => (
    <>
      <Shadow rx={17} />
      <path d="M13 24h38v28a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3z" fill="#EDF3FC" />
      <rect x="11" y="20" width="42" height="6" rx="3" fill="#64748B" />
      <path d="M20 26v29M27 26v29M34 26v29M41 26v29M48 26v27" stroke="#94A3B8" strokeWidth="2.2" />
      <path d="M13 40h38" stroke="#94A3B8" strokeWidth="2.2" />
      <path d="M27 18h10a5 5 0 0 1 0-4H27a5 5 0 0 1 0 4z" fill="#94A3B8" />
      <circle cx="32" cy="44" r="7" fill="#E7B183" />
      <circle cx="26.5" cy="38.5" r="3" fill="#D9A273" />
      <circle cx="37.5" cy="38.5" r="3" fill="#D9A273" />
      <circle cx="29.4" cy="43" r="1.4" fill="#3B2515" />
      <circle cx="34.6" cy="43" r="1.4" fill="#3B2515" />
      <path
        d="M30.4 47a2.4 2.4 0 0 0 3.2 0"
        stroke="#5B3B22"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  /** 캣타워 */
  cattower: () => (
    <>
      <Shadow rx={16} />
      <rect x="14" y="50" width="36" height="5" rx="2.5" fill="#C9945F" />
      <rect x="28" y="26" width="8" height="24" fill="#E3B486" />
      <rect x="16" y="34" width="18" height="5" rx="2.5" fill="#D9A273" />
      <rect x="32" y="20" width="18" height="5" rx="2.5" fill="#D9A273" />
      <circle cx="41" cy="14" r="6" fill="#94A3B8" />
      <path d="M37 10l1-4 3 3M45 10l-1-4-3 3" fill="#94A3B8" />
      <circle cx="39" cy="14" r="1.4" fill="#1F2937" />
      <circle cx="43.4" cy="14" r="1.4" fill="#1F2937" />
      <path
        d="M40 17a2 2 0 0 0 2.6 0"
        stroke="#1F2937"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M22 34c-4 2-6 6-5 10"
        stroke="#94A3B8"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),

  // ── 생활 ────────────────────────────────────────────────
  /** 사다리 */
  ladder: () => (
    <>
      <Shadow rx={17} />
      <path d="M20 54L26 12M44 54L38 12" stroke="#F5C451" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M25 20h14M23.6 30h16.8M22 40h20M20.6 50h22.8"
        stroke="#E0AC33"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <Face y={35} s={0.7} />
    </>
  ),
  /** 스탠드 조명 */
  standlight: () => (
    <>
      <Shadow rx={13} />
      <ellipse cx="32" cy="53" rx="12" ry="3.4" fill="#64748B" />
      <path d="M31 24h2v29h-2z" fill="#94A3B8" />
      <path d="M20 24l6-12h12l6 12z" fill="#F5C451" />
      <path d="M20 24h24v3H20z" fill="#E0AC33" />
      <circle cx="32" cy="31" r="4" fill="#FDE047" opacity="0.6" />
      <Face y={19} s={0.72} />
    </>
  ),
  /** 전신거울 */
  mirror: () => (
    <>
      <Shadow rx={14} />
      <rect x="18" y="10" width="28" height="44" rx="6" fill="#94A3B8" />
      <rect x="22" y="14" width="20" height="36" rx="4" fill="#DCE8FB" />
      <path d="M24 44l14-26h3L27 46z" fill="#FFFFFF" opacity="0.55" />
      <Face y={34} s={0.8} />
    </>
  ),
  /** 액자 · 미술품 */
  frame: () => (
    <>
      <Shadow rx={16} />
      <rect x="12" y="14" width="40" height="34" rx="3" fill="#C9945F" />
      <rect x="16" y="18" width="32" height="26" rx="2" fill="#EDF3FC" />
      <path d="M16 44l9-12 6 7 5-8 12 13z" fill="#7FC3F5" />
      <circle cx="24" cy="25" r="3" fill="#F5C451" />
      <path d="M26 48h12v6H26z" fill="#B0754A" />
      <Face y={38} s={0.65} />
    </>
  ),
  /** 청소도구 */
  cleaningTool: () => (
    <>
      <Shadow rx={16} />
      <path d="M22 12v30" stroke="#B0754A" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M14 42h16l-2 12H16z" fill="#F5C451" />
      <path d="M42 14v22" stroke="#94A3B8" strokeWidth="3.4" strokeLinecap="round" />
      <rect x="34" y="36" width="16" height="8" rx="2" fill="#5FA8FF" />
      <path d="M34 44h16l-1.4 10H35.4z" fill="#9BDCF2" />
      <Face x={32} y={26} s={0.62} />
    </>
  ),
  /** 정리함 */
  storagebin: () => (
    <>
      <Shadow rx={17} />
      <rect x="12" y="24" width="40" height="6" rx="2" fill="#7FC3F5" />
      <path d="M14 30h36l-3 22a3 3 0 0 1-3 2.6H20a3 3 0 0 1-3-2.6z" fill="#BFE6F7" />
      <path d="M25 26h14v6H25z" fill="#5FA8FF" />
      <Face y={42} s={0.95} />
    </>
  ),
  /** 캐리어 · 여행가방 */
  luggage: () => (
    <>
      <Shadow rx={15} />
      <path d="M27 18v-6h10v6" stroke="#64748B" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="16" y="18" width="32" height="34" rx="5" fill="#EF6B5E" />
      <rect x="24" y="18" width="6" height="34" fill="#DC5648" />
      <rect x="20" y="30" width="24" height="6" rx="2" fill="#FFFFFF" opacity="0.4" />
      <circle cx="22" cy="55" r="2.4" fill="#334155" />
      <circle cx="42" cy="55" r="2.4" fill="#334155" />
      <Face x={37} y={42} s={0.72} />
    </>
  ),

  // ── 주방살림 ─────────────────────────────────────────────
  /** 그릇장 · 주방 수납장 */
  dishcabinet: () => (
    <>
      <Shadow rx={16} />
      <rect x="14" y="12" width="36" height="43" rx="3" fill="#D9A97C" />
      <rect x="17" y="16" width="30" height="16" rx="2" fill="#DCE8FB" />
      <rect x="17" y="35" width="30" height="16" rx="2" fill="#F2DCC2" />
      <path d="M32 16v16M32 35v16" stroke="#C9945F" strokeWidth="1.6" />
      <ellipse cx="24" cy="24" rx="5" ry="1.8" fill="#FFFFFF" />
      <ellipse cx="40" cy="24" rx="5" ry="1.8" fill="#FFFFFF" />
      <circle cx="29.6" cy="43" r="1.4" fill="#8B6A4F" />
      <circle cx="34.4" cy="43" r="1.4" fill="#8B6A4F" />
      <Face y={20} s={0.62} />
    </>
  ),
  /** 쌀통 */
  ricebin: () => (
    <>
      <Shadow rx={14} />
      <rect x="18" y="18" width="28" height="6" rx="2" fill="#94A3B8" />
      <path d="M19 24h26v28a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3z" fill="#EDF3FC" />
      <rect x="24" y="34" width="16" height="10" rx="2" fill="#F5C451" opacity="0.45" />
      <circle cx="32" cy="49" r="2.4" fill="#94A3B8" />
      <Face y={30} s={0.78} />
    </>
  ),
  /** 재봉틀 */
  sewing: () => (
    <>
      <Shadow rx={17} />
      <rect x="12" y="44" width="40" height="9" rx="2" fill="#C9945F" />
      <path d="M16 20h8v24h-8z" fill="#475569" />
      <path d="M16 20h30v8H16z" fill="#64748B" />
      <path d="M42 28h4v10h-4z" fill="#475569" />
      <path d="M43.5 38v6" stroke="#94A3B8" strokeWidth="1.8" />
      <circle cx="20" cy="32" r="4" fill="#94A3B8" />
      <Face x={32} y={24} s={0.62} />
    </>
  ),
};

// 같은 그림을 여러 품목이 함께 씁니다.
CHARS.clayBed = CHARS.stoneBed;
CHARS.glassTable = CHARS.marbleTable;
CHARS.bigSafe = CHARS.safe;

// ============================================================
// 품목 ↔ 캐릭터 연결
// ============================================================
/** 품목 id 로 바로 연결 (가장 정확합니다) */
export const ITEM_CHAR: Record<string, string> = {
  // ── 가전 (3D 가 없는 것) ──
  robotvac: "robotVacuum",
  fan: "fan",
  bidet: "bidet",
  printer: "printer",
  sewing: "sewing",
  // ── 주방 ──
  riceCooker: "riceCooker",
  airfryer: "airfryer",
  coffee: "coffee",
  dishrack: "dishrack",
  dishcabinet: "dishcabinet",
  kitchencabinet: "dishcabinet",
  potset: "pot",
  ricebin: "ricebin",
  kimchipot: "sauce",
  // ── 가구 ──
  hanger: "hanger",
  shoerack: "shoeRack",
  marbletable: "marbleTable",
  // ── 생활용품 ──
  drying: "drying",
  toolbox: "toolbox",
  cleaning: "cleaningTool",
  ladder2: "ladder",
  standlight: "standlight",
  mirror: "mirror",
  frame: "frame",
  curtain: "curtain",
  carpet: "carpet",
  blanket: "blanket",
  storagebin: "storagebin",
  luggage: "luggage",
  // ── 취미·레저 ──
  plant: "plant",
  bigplant: "plant",
  bicycle: "bicycle",
  kickboard: "kickboard",
  golf: "golf",
  camping: "camping",
  ski: "ski",
  fitness: "exercise",
  // ── 유아·반려 ──
  stroller: "stroller",
  babyitems: "baby",
  petcage: "petcage",
  cattower: "cattower",
  // ── 특수 ──
  safe: "safe",
  aquarium: "aquarium",
  massagechair: "massageChair",
  treadmill: "treadmill",
  bike2: "gymEquip",
  art: "frame",
  waste: "disposal",
  // ── 잔짐 ──
  clothbox: "clothbox",
  bigbox: "bigbox",
  midbox: "midbox",
  bookbox: "books",
  kitchenbox: "dishes",
  smallbox: "midbox",
  basket: "basket",
  bag: "bag",
  blanketbag: "blanket",
  vinyl: "vinyl",
};

/**
 * 이름으로 찾기 — 직접 추가한 품목, 옵션 이름, AI 가 읽어 온 이름에 씁니다.
 * 위에 있는 줄이 먼저 걸리므로 구체적인 단어를 위에 둡니다.
 */
const NAME_CHAR: { words: string[]; key: string }[] = [
  // 특수품목
  { words: ["안마의자", "바디프랜드"], key: "massageChair" },
  { words: ["금고"], key: "safe" },
  { words: ["모션침대"], key: "motionBed" },
  { words: ["돌침대", "흙침대", "황토"], key: "stoneBed" },
  { words: ["대리석", "유리식탁"], key: "marbleTable" },
  { words: ["수족관", "어항"], key: "aquarium" },
  { words: ["런닝", "러닝머신", "트레드밀"], key: "treadmill" },
  { words: ["헬스", "웨이트", "바벨", "벤치프레스"], key: "gymEquip" },
  { words: ["복사기"], key: "copier" },
  // 생활용품
  { words: ["캠핑", "텐트", "야영"], key: "camping" },
  { words: ["유아", "아기", "인형", "장난감", "유모차"], key: "baby" },
  { words: ["화분", "화초", "식물", "나무"], key: "plant" },
  { words: ["옷박스"], key: "clothbox" },
  { words: ["대박스"], key: "bigbox" },
  { words: ["중박스", "소박스"], key: "midbox" },
  { words: ["바구니", "소쿠리"], key: "basket" },
  { words: ["가방", "잡화", "캐리어", "여행"], key: "bag" },
  { words: ["비닐", "봉투"], key: "vinyl" },
  { words: ["이불", "침구", "베개", "요"], key: "blanket" },
  { words: ["의류", "옷", "코트", "정장"], key: "clothes" },
  { words: ["책", "도서", "만화"], key: "books" },
  { words: ["그릇", "접시", "공기"], key: "dishes" },
  { words: ["냄비", "솥", "프라이팬"], key: "pot" },
  { words: ["식기", "수저", "커트러리"], key: "tableware" },
  { words: ["조리", "주방용품", "국자", "도마"], key: "cookware" },
  { words: ["양념", "조미료", "장독", "간장"], key: "sauce" },
  { words: ["커튼", "블라인드"], key: "curtain" },
  { words: ["카펫", "러그", "매트"], key: "carpet" },
  { words: ["식기건조", "건조대"], key: "dishrack" },
  { words: ["빨래", "빨래건조"], key: "drying" },
  { words: ["공구", "연장", "드릴"], key: "toolbox" },
  { words: ["운동기구", "아령", "덤벨", "요가"], key: "exercise" },
  // 3D 가 없는 가전·가구
  { words: ["로봇청소기"], key: "robotVacuum" },
  { words: ["커피", "에스프레소"], key: "coffee" },
  { words: ["밥솥", "전기밥솥"], key: "riceCooker" },
  { words: ["에어프라이", "튀김기"], key: "airfryer" },
  { words: ["선풍기", "서큘레이터"], key: "fan" },
  { words: ["신발장", "신발"], key: "shoeRack" },
  { words: ["행거"], key: "hanger" },
  { words: ["프린터", "복합기"], key: "printer" },
  { words: ["비데"], key: "bidet" },
];

/**
 * 옵션·작업 이름 전용 (에어컨 이전 설치, 입주 청소, 폐기물 처리 …).
 *
 * 여기 있는 단어는 품목 이름에는 거의 안 쓰이기 때문에
 * 3D 이미지보다 **먼저** 확인해서 작업에 어울리는 그림이 나오게 합니다.
 */
const WORK_CHAR: { words: string[]; key: string }[] = [
  {
    words: ["에어컨설치", "에어컨이전", "에어컨철거", "에어컨탈부착", "에어컨이설"],
    key: "acWork",
  },
  { words: ["세탁기설치", "세탁기연결"], key: "washerWork" },
  { words: ["청소", "새집"], key: "cleaning" },
  { words: ["폐기", "버릴", "쓰레기", "수거"], key: "disposal" },
  { words: ["분해", "조립", "설치", "철거", "탈부착"], key: "assembly" },
  { words: ["포장자재", "자재비", "박스비", "완충", "뽁뽁이", "테이프"], key: "packing" },
  { words: ["주차", "도로사용", "사용료", "통행"], key: "parking" },
];

/** 옵션·작업 이름으로 어울리는 캐릭터 찾기 (품목보다 먼저 확인합니다) */
export function guessWorkCharKey(name: string): string | undefined {
  const n = (name || "").toLowerCase().replace(/\s/g, "");
  if (!n) return undefined;
  for (const { words, key } of WORK_CHAR) {
    if (words.some((w) => n.includes(w))) return key;
  }
  return undefined;
}

/** 품목·옵션 이름으로 어울리는 캐릭터 찾기 */
export function guessCharKey(name: string): string | undefined {
  const n = (name || "").toLowerCase().replace(/\s/g, "");
  if (!n) return undefined;
  for (const { words, key } of NAME_CHAR) {
    if (words.some((w) => n.includes(w))) return key;
  }
  return undefined;
}

/** 캐릭터가 있는지 확인 */
export function hasChar(key?: string): boolean {
  return !!key && !!CHARS[key];
}

/** 캐릭터 한 개 그리기 */
export function CharArt({
  name: key,
  alt,
  size = 64,
  className = "",
}: {
  /** CHARS 의 키 */
  name: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  const Draw = CHARS[key] ?? CHARS.generic;
  return (
    <span
      className={`relative inline-flex shrink-0 items-end justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        role="img"
        aria-label={alt}
        className="h-full w-full drop-shadow-[0_6px_10px_rgba(15,23,42,0.12)]"
      >
        <Draw />
      </svg>
    </span>
  );
}

/** 만들어 둔 캐릭터 이름 목록 (개발 확인용) */
export const CHAR_KEYS = Object.keys(CHARS);
