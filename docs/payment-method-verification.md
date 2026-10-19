# 결제수단 분리 시험 — 2026-10-19

## 원인
PaymentPanel은 결제완료 클릭 후 balanceReceiptReady가 거짓이면 곧바로 현금 확인창을 열었다. 입금 기록이 부족하거나 없으면 카드·계좌이체도 현금으로 보였고, 서버의 명시적 완료 수단은 cash 한 가지뿐이었다.

## 변경 파일
- src/components/jimpick/PaymentPanel.tsx: 현금 결제·계좌이체·카드 결제·취소 선택, 각 수단별 확인, 카드 승인번호·메모, 중복 확인 잠금.
- src/components/jimpick/DepositPanel.tsx: 계좌 입금 기록·계좌이체 확인 버튼.
- src/components/jimpick/screens.tsx: 계좌이체 확인 필요와 완료 보관함 수단 표시.
- src/lib/payment.functions.ts: 완료는 명시적 수단을 검증하고 잠금 RPC 호출; 기존 현금 자동 분기와 완료 중 문자 예약 호출 제거.
- src/lib/deposit.functions.ts: 새 은행 입금 수단 저장, 실제 잔금 확인은 수단별 RPC 연결; 예약금·고객 자가알림은 기존 기록 확인 유지.
- src/lib/terms.functions.ts / payment-review.ts: 입금기록별 수단 전달.
- src/lib/payment-method.ts / payment-method.test.ts: 수단 정규화·미분류·남은 금액 규칙.
- drizzle/migrations/0026_separate_payment_methods.sql: 신규 필드와 소유 업체 잠금 완료 함수.
- src/integrations/supabase/types.ts: 도구가 자동 갱신.
- AGENTS.md / roadmap.md: 구현 규칙·시험 상태 기록.

## 저장 값과 필드
- estimate_terms.payment_method, deposit_records.payment_method: cash / bank_transfer / card. 기존 NULL 또는 알 수 없는 값은 읽을 때 미분류로 표시하고 일괄 수정하지 않음.
- deposit_records.status: pending_review → confirmed. 입금액 amount, 입금자 depositor_name, 시각 deposited_at, 견적 estimate_id, 확인 confirmed_at / confirmed_by.
- estimate_terms.payment_status: 충분한 확인 잔금은 completed; 부분 잔금은 partial 유지, 예약금 확인만으로 전체 완료하지 않음.
- estimate_terms.payment_amount: 이번 확인금액; balance_paid: 확인된 잔금; payment_confirmed_at / payment_confirmed_by: 확인시각·담당자.
- 카드 card_approval_number와 payment_note; 완료 paid_at / calendar_archived / calendar_archived_at / calendar_archived_by.
- total과 deposit_paid는 완료 함수에서 변경하지 않음. 기존 완료는 재실행해도 수단·금액을 덮어쓰지 않음.
- 은행 자동 수신 연동을 새로 추가한 작업은 아님. 기존 은행 문자 붙여넣기·직접 등록 경로가 bank_transfer, pending_review로 저장됨.

## 실제 화면 및 저장 시험
요청자 계정으로 로그인한 384×682 Chromium에서 기존 고객과 분리된 시험 견적 3건 사용. 총액 각 1,000,000원, 기존 예약금 50,000원, 남은 잔금 950,000원.

1. 현금: 결제완료 → 3수단·취소 먼저 표시, 현금 선택 뒤에만 잔금 950,000원 현금 문구 표시. 확인 버튼 전 상태 deposit_paid 유지. 버튼 후 cash / completed / payment_amount 950000 / balance_paid 950000 / 확인자·시각 / 보관 저장 확인.
2. 계좌이체: 기존 registerDeposit으로 950,000원, 계좌시험입금자, balance 등록. 15초 자동 갱신 후 카드 전체 4px rgb(255,138,0), 계좌이체 확인 필요 · 950,000원, 이름·금액 표시. 상세 계좌이체 확인 후 confirmed와 bank_transfer 저장, 카드 제거 및 보관 이동. 현금 문구 없음.
3. 카드: 카드 선택에서 금액 950,000원·카드 표시, 승인번호 QA-CARD-950 입력 후 확인. card / completed / 950000 / 확인자·시각·승인번호 저장. 현금 문구 없음.
4. 새로고침 후 세 건 모두 진행 내역에서 제외되고 완료 보관함에서 현금 결제완료·계좌이체 완료·카드 결제완료 표시.
5. 세 건 모두 total 1000000 / deposit_paid 50000 그대로 유지. 기존 estimate_terms·deposit_records·estimate_deliveries·sms_usage_events·move_reminders 조회값 전후 동일. 은행 확인 notified_at NULL 유지.
6. 브라우저 문자 전송 경로 감시 0건, 실행 오류 0건. 완료 경로는 문자·미리보기·발송기록·예약 함수를 호출하지 않음. 기본 문자 앱을 여는 코드도 없음.
7. 관련 27개 규칙 시험 통과. 최신 자동 검사 build OK.
8. 이번에 만든 세 시험 견적과 해당 시험 입금만 삭제하여 정리. 기존 자료는 변경하지 않음.

## 미시험
실제 카드 승인/단말기 결제, 실제 은행 자동 수신, 실물 휴대전화 문자 앱·수신함은 시험하지 않음. 카드 기능은 업체가 이미 받은 결제를 확인하여 기록하는 기능이며 실제 카드 청구 기능이 아님. 부분 잔금·다중 입금자·다른 업체 접근 거부의 새 RPC 전체 흐름은 이번 브라우저 시험에 포함하지 않음.