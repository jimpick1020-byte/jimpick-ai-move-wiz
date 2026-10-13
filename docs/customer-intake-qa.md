# 고객 사전정보 수정·검증 보고

## 수정 범위
- `src/components/jimpick/IntakePage.tsx`: 선택된 들어가는 주소 아래 검색창 숨김, 상세주소 유지, 서버 제출 성공 후 완료 안내와 1.5초 뒤 history.back(), 돌아갈 기록이 없는 새 탭의 sms: 대체 버튼, 실패 시 다시 저장, 비공개 이미지 URL 갱신, 기존 방 이미지 적용.
- `src/components/jimpick/IntakePanel.tsx`: 플랫폼 관리자만 고객 품목 관리, 생성·수정·확인 후 삭제·드래그 순서 저장.
- `src/lib/intake.functions.ts`: 서버 관리자 검증, customer_* 설정과 영구 Storage 이미지 연결, 900초 서명 URL, 제출 시 기존 초안에 한글 이름·그림 경로 스냅샷 저장.
- `src/lib/intake.ts`: 명시적 층·지하층·동/호수 구분, 큰 품목 제한과 한글 이름 복구.
- `src/lib/item-icon.functions.ts`: 고객 전용 행을 일반 견적 품목 목록에서 제외.
- `src/styles.css`: 고객 화면에만 흰색·하늘색·파란 버튼 적용.
- `src/lib/intake.test.ts`: 층수, 품목 제한, 이름, 초안 연결, 관리자 역할 테스트.

## 오류 원인
고객용 사용자 정의 품목 ID의 이미지 연결이 빠져 공통 아이콘의 기본 박스 그림으로 대체됐다. 기존 Storage 경로와 고객 이미지 URL을 명시적으로 연결하고, 이름은 한글 표시명으로 복구했다. 파일이 없는 고객 설정 행을 이미지 제공 경로로 연결하면 그림이 실패할 수 있어 실제 image_path/storage_path가 있을 때만 해당 경로를 초안에 저장하도록 보완했다.

새 탭에서 history.back()이 최초 빈 페이지로 이동하면 완료 화면이 사라져 대체 버튼 타이머도 사라졌다. 되돌아갈 기록이 없는 경우 같은 문서의 이력을 마련한 후 back을 실행해 sms: 버튼이 남도록 했다. 실제 문자 앱 복귀 가능 여부는 OS와 브라우저에 따라 다르다.

## 데이터베이스
새 중복 테이블 없이 기존 item_icons에 customer_visible, customer_room, customer_order, customer_category, customer_name, customer_size, customer_disposal_allowed, customer_only, customer_key, customer_deleted_at을 추가했다.

적용한 마이그레이션:
- `drizzle/migrations/0009_customer_catalog_settings.sql`
- `drizzle/migrations/0010_customer_order_atomic.sql`
- `drizzle/migrations/0011_protect_customer_only_rows.sql`

서버에서 user_roles의 admin/super_admin을 확인하고, DB 트리거와 순서 저장 RPC에서도 역할을 검사한다. 일반 업체는 고객 설정을 관리할 수 없다. 업체 기존 품목은 업체 범위를 유지하며 고객 전용 플랫폼 카탈로그는 고객 링크들에서 공유한다.

요청의 company_id는 기존 estimate_drafts.user_id에 연결하고 미리 할당한 estimate_id를 재사용한다. 고객 제출은 같은 초안을 갱신한다. 삭제는 고객 목록에서 숨기는 방식으로 기존 견적 스냅샷과 Storage 파일을 보존한다. 테스트 이미지도 보존한다.

## 실제 수행한 검증
- 테스트 링크로 여러 번 서버 제출 후 연결된 초안은 1건 유지.
- Supabase 초안에서 출발지 `101동 502호`는 5층, 도착지 `105-1001`은 10층 확인.
- 사장님 견적 내역에서 테스트 고객 카드 확인, 기존 견적 화면에 고객 이름·주소·상세주소 반영 확인.
- 기존 직접 선택 화면에서 책장 실제 그림·한글 이름·수량 2개 확인.
- 관리자 테스트 책장 생성 후 서명 URL 이미지 로딩 확인, 확인 후 고객 목록 삭제와 재조회 유지 확인. 원본 행·이미지는 보존.
- 드래그 순서 변경과 재조회 유지 확인 후 테스트 이전 순서 복원.
- 완료 안내 후 새 탭 sms: 대체 버튼 표시 확인.
- 브라우저 네트워크 차단 시 완료 표시·이동 없이 저장 실패와 다시 저장 버튼 확인.
- 관련 자동 테스트 18개 통과, 최신 자동 빌드 로그 build OK 확인.

## 남은 제한
실제 휴대전화와 문자 앱 복귀는 시험하지 못했다. 모든 브라우저의 back 동작을 보장할 수 없다. 브라우저는 고정 1280×1800 뷰포트에서 앱의 좁은 고객 화면을 시험했다. 실제 문자 발송은 수행하지 않았다. 일반 업체 계정으로 관리 API를 직접 호출하는 종단 간 권한 시험은 수행하지 않았으며 역할 규칙과 서버·DB 검증을 확인했다. 실패 안내는 실제 실패에 근거하지만 고객 화면에는 기술적인 서버 오류 전문 대신 간단한 안내를 사용한다.

기존 고객·견적·계약·품목·사진·달력·문자 기록은 삭제하거나 초기화하지 않았다.