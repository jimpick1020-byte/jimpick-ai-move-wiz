# AuthShell 입력 접근성 보완

## 변경 내용
- `AuthInput`의 높이와 포커스 링을 임의값 Tailwind 문법으로 변경합니다.
- React 입력·버튼 속성 타입을 명시적으로 `type` import해 사용합니다.
- 로그인, 회원가입, 아이디·비밀번호 찾기의 모든 `AuthField` 입력에 `id`, `name`, `autoComplete`, `aria-invalid`, `aria-describedby`를 상태에 맞게 연결합니다.
- 비밀번호 입력의 보기·숨기기 버튼은 `type="button"`을 유지하고 제출을 유발하지 않도록 확인합니다.

## 검증
- TypeScript 검사와 자동 빌드 결과를 확인합니다.
- 390px 모바일 화면에서 입력 높이, 오류·안내 연결, 비밀번호 버튼, 가로 넘침을 확인합니다.
- 기존 로그인, 회원가입, Google 로그인, 비밀번호 재설정 호출 로직은 변경하지 않습니다.
