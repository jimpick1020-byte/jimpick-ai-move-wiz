# 견적잇 외부 호스팅(Cloudflare) 배포 안내

## 구성 요약

- 화면 + 서버 기능: Cloudflare Workers (무료 범위)
- 데이터·로그인·파일 저장: 기존 Lovable Cloud 그대로 사용 (이전하지 않음)
- 입금 문자 수신 주소·인증키: 기존 Lovable 운영 주소 그대로 유지
  → 운영 사이트(jimpick-ai-move-wiz.lovable.app)는 게시 상태를 유지해야 입금 자동 수신이 계속됩니다.
  외부 시험 주소와 운영 주소는 같은 데이터베이스를 보므로 입금 내역이 양쪽에 같이 표시됩니다.

## 준비 완료된 것 (이 저장소)

- `wrangler.jsonc` (루트): Cloudflare 서비스 이름 `gyejeokkit`, Node 호환 모드(nodejs_compat).
  빌드할 때마다 `dist/server/wrangler.json`에 자동으로 합쳐집니다.
- `npm run build` (Node 22) → `dist/` 에 Cloudflare Workers 형태로 생성됨을 확인했습니다.
- Cloudflare와 같은 실행 환경(workerd)에서 시험 완료:
  첫 화면 200 · 견적서 공유 화면 200 · 입금 문자 수신 주소가 잘못된 키를 401로 정상 거부 · 아이콘/매니페스트 정상.

## 비용

- Cloudflare Workers 무료: 하루 10만 회 요청까지 무료. 견적잇 사용량이면 충분합니다.
  초과 시에만 Workers Paid(월 $5)가 필요합니다.
- Lovable Cloud(데이터·로그인): 기존과 동일하게 월 무료 범위가 적용됩니다.
- 그 외 예상 비용 없음. (별도 도메인을 사면 도메인 비용만 발생)

## 배포 절차 (사장님 Cloudflare 계정 필요)

1. Lovable에서 GitHub 연결로 이 저장소를보냅니다 (모든 플랜 가능).
2. Cloudflare 대시보드 → Workers → 저장소 연결(Workers Builds) 또는 Pages에서 저장소를 선택합니다.
3. 빌드 설정: 빌드 명령 `npm run build`, 출력 폴더 `dist`, Node.js 22.
4. 아래 환경 변수를 Cloudflare에 등록합니다.
5. 배포되면 `gyejeokkit.workers.dev` 형태의 시험 주소가 생깁니다.

### 환경 변수 목록

빌드 시 (브라우저용, 공개 가능):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

서버 실행 시 (비공개):
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- `ALIGO_API_KEY`, `ALIGO_USER_ID`, `ALIGO_SENDER`, `ALIGO_TEST_MODE=N` (문자 발송)
- `KAKAO_MAP_JS_KEY`, `KAKAO_REST_API_KEY` (지도·주소)

로그인 설정:
- 새 시험 주소를 로그인 허용 주소(redirect URL)에 추가해야 Google 로그인이 됩니다.

## 외부 호스팅에서 동작하지 않는 것 (중요)

아래 두 키는 Lovable Cloud 밖으로 값을 꺼낼 수 없어서, 외부 서버에 등록할 수 없습니다.

- `SUPABASE_SERVICE_ROLE_KEY` (관리자 키)
- `LOVABLE_API_KEY` (AI 게이트웨이)

따라서 외부 시험 주소에서는 아래 기능이 실패합니다.

- 예약금·잔금 확인 처리, 입금 자동 연결 기록 쓰기 (관리자 키 필요)
- 고객 안내 문자·리마인더 문자 발송 (관리자 키 + 알리고 연동)
- AI 촬영·품목 이미지 생성/검증 (AI 키 필요)
- 작업자 연락처·회사 기본값 등 관리자 키를 쓰는 저장

로그인, 견적서 보기·공유, PDF 인쇄 등 공개 키만 쓰는 기능은 동작합니다.
입금 문자 수신 자체는 기존 Lovable 주소가 계속 처리하므로, 외부 화면에서도 입금 내역 "조회"는 됩니다.

## 완전 이전을 원하면

모든 기능을 외부에서 쓰려면 데이터·로그인·파일 저장을 사장님 소유의 별도 Supabase로
이전하는 작업이 필요합니다 (관리자 키를 직접 소유하게 됨). 규모가 큰 작업이므로
필요하면 별도로 요청해 주세요.
