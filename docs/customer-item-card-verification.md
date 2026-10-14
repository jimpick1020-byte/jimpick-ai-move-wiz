# 고객 품목 화면 수정 및 시험 결과

## 수정 파일
- `src/components/jimpick/screens.tsx`: 기본품목 다시 적용 버튼 제거, 4단계/품목창 뒤로가기, 고객 카드 재선택 해제, 고객 관리 카드의 사전정보 요청 버튼 제거.
- `src/components/jimpick/ItemListLayer.tsx`, `RoomPickedStrip.tsx`, `src/styles.css`: 공용 검은 품목 카드, 균일한 크기, 점 3개 메뉴 제거.
- `src/components/jimpick/IntakePanel.tsx`: 고객 관리 상단 버튼 2개 제거, 고객 선택 품목 빨간 휴지통과 원본 이름 표시.
- `src/lib/jimpick-art.tsx`, `jimpick-icon3d.tsx`, `use-item-cutout.ts`, `item-cutout.ts`, `item-cutout.test.ts`: 원본 이미지 파일을 변경하지 않고 브라우저에서 밝은 사각 배경을 투명 PNG로 처리, 원본 해상도·contain 유지.
- `src/lib/intake.functions.ts`, `drizzle/migrations/0019_remove_customer_selected_item.sql`: 로그인한 업체의 요청과 같은 견적 초안의 해당 방 품목만 삭제하는 잠금 RPC. item_icons DELETE 없음.
- `src/integrations/supabase/types.ts`: 마이그레이션 후 자동 생성.
- `src/lib/AGENTS.md`: 관련 유지보수 규칙.

## 직접 시험 (Chromium 모바일 384×681)
| 항목 | 결과 |
|---|---|
| 품목창 뒤로가기 | 통과: 품목창 닫힘, 4단계 시작 화면 유지 |
| 4단계 시작 뒤로가기 | 통과: 고객 3단계 작업조건 화면 복귀 |
| 이전 화면 없는 경우 | 코드의 4단계 fallback 확인; 직접 진입 브라우저 시험 미실시 |
| 기본품목 다시 적용 | 통과: 버튼 0개 |
| 카드 검은 배경/같은 크기 | DOM 127개 카드 모두 112×192, 동일 검은 배경 |
| 냉장고 이미지 | 17개 모두 로딩 성공, 96×96, object-fit contain, 투명 PNG; 화면에서 사각 배경 제거 확인 |
| 모든 품목 이미지 선명도 | 전체 이미지 육안 전수검사 미실시; 냉장고·침대 표본만 확인 |
| 점 3개 메뉴 | 공용 카드/선택 목록에서 제거; 시험 품목창 관리 메뉴 0개 |
| 고객 다시 눌러 해제 | 통과: aria-pressed true → false; 다시 선택 후 실제 제출 성공 |
| 사장님 고객 선택 삭제 | 통과: 시험고객 침대 선택 휴지통 클릭 후 성공 알림, 선택 삭제 버튼 1→0 |
| 원본 보존 | 통과: item_icons 삭제 전후 101건; 해당 시험 견적 방 items/disposal만 비워짐 |
| 관리자 원본 삭제 권한/확인창 | 기존 서버 관리자 검사·확인창 코드 유지; 실제 원본 삭제 시험 미실시(자료 보존) |
| 요청한 고객 관리 버튼 3개 | 모두 0개; 기존 요청 기록 표시 유지 |
| 새로고침/새 인증 세션 | 고객명·날짜·주소 유지 확인; 사장님 삭제 항목 새로고침 및 새로운 인증 브라우저에서도 0개 유지 |
| 명시적 로그아웃 버튼→로그인 UI | 미실시; 인증 세션을 새 브라우저에 복원하여 확인 |

시험용 요청 1건을 추가해 제출했으며 그 시험 고객의 선택 침대만 삭제했습니다. 기존 고객·정식 견적·계약·결제와 원본 품목을 삭제하거나 초기화하지 않았습니다. 주소 검색 전체 흐름은 이번 카드 시험 대상이 아니며 시험용 주소를 해당 시험 요청에만 입력했습니다.

단위 회귀 시험: `bun test src/lib/item-cutout.test.ts src/lib/room-item-state.test.ts src/lib/intake.test.ts` — 26개 통과, 0개 실패.
자동 빌드 로그: 마지막 확인 `build OK`.
이미지 CORS/캔버스 처리 실패 시 원본으로 돌아가므로, 표본 외 모든 이미지의 흰 사각형 제거를 완료로 주장하지 않습니다. Samsung Browser 실기기 시험은 미실시입니다.