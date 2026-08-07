# 부동산 1분 블로그 비서 (Streamlit)

5060 세대 공인중개사를 위한 모바일 최적화 부동산 블로그 초안 생성기입니다.
현장에서 사진을 찍고 아파트 이름과 가격만 입력하면 **진짜 AI(Google Gemini)** 가
사진까지 살펴보고 블로그 초안을 작성하고, 사장님이 직접 확인·수정한 뒤 발행하는
Human-in-the-loop 흐름으로 동작합니다.

> 참고: 이 앱은 메인 React(JIMPICK) 앱과는 별개로 동작하는 독립 Streamlit 프로토타입입니다.

## 사용 흐름

1. 매물 사진 업로드 (여러 장 가능)
2. 아파트 이름 · 가격/조건 입력
3. "블로그 글 뚝딱 완성하기" 버튼 → **Gemini AI가 사진과 정보를 반영해 초안 작성**
4. 생성된 제목/본문을 확인·수정 후 발행

## 실행 방법

```bash
cd streamlit-blog-generator
pip install -r requirements.txt
streamlit run app.py
```

## Gemini API 키 설정

실제 AI 글쓰기를 사용하려면 Gemini API 키가 필요합니다.
[Google AI Studio](https://aistudio.google.com/apikey)에서 무료로 발급받을 수 있습니다.

키를 넣는 방법은 세 가지이며, 아래 순서로 먼저 찾은 키를 사용합니다.

1. **secrets 파일** — `.streamlit/secrets.toml.example` 를 `.streamlit/secrets.toml`
   로 복사한 뒤 키를 넣습니다. (이 파일은 `.gitignore`에 등록되어 깃에 올라가지 않습니다.)
   ```toml
   GEMINI_API_KEY = "AIza...실제키"
   ```
2. **환경변수** — `export GEMINI_API_KEY="AIza...실제키"` (또는 `GOOGLE_API_KEY`)
3. **사이드바 입력** — 앱 왼쪽 사이드바에 직접 붙여넣기

키가 하나도 없으면 앱은 멈추지 않고 **예시(샘플) 글**로 미리보기를 보여줍니다.

사용 모델은 `app.py` 상단의 `GEMINI_MODEL` 값(기본 `gemini-2.5-flash`)에서 바꿀 수 있습니다.

## 네이버 블로그 발행 설정 (4단계)

4단계는 **네이버 로그인(OAuth2) + 블로그 글쓰기 API** 로 실제 발행합니다.

1. [네이버 개발자센터](https://developers.naver.com)에서 애플리케이션을 등록합니다.
2. 사용 API에 **네이버 로그인**과 **블로그**(글쓰기)를 추가합니다.
3. 로그인 콜백(Callback) URL에 앱이 실행되는 주소를 등록합니다.
   (로컬 개발이라면 보통 `http://localhost:8501`)
4. 발급받은 `Client ID` / `Client Secret` / `Redirect URI` 를
   `secrets.toml`(또는 환경변수 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`,
   `NAVER_REDIRECT_URI`), 혹은 사이드바에 입력합니다.

### 발행 흐름

1. 3단계에서 만든 글을 확인·수정합니다.
2. **네이버 로그인** 버튼을 눌러 본인 계정으로 로그인/동의합니다.
   (네이버가 앱으로 다시 돌아오면 자동으로 토큰을 발급받습니다.)
3. **발행하기** 버튼을 누르면 실제 블로그에 글이 올라가고, 가능한 경우 글 링크가 표시됩니다.

네이버 앱 설정이 없으면 발행 버튼은 **연습(시뮬레이션)** 으로 동작해 앱은 계속 사용할 수 있습니다.

### 한계 / 참고

- 3단계 글 생성은 실제 Gemini AI가 담당합니다(사진 멀티모달 반영).
- 현재 발행은 **글(제목·본문) 위주**입니다. 업로드한 사진은 AI 글쓰기 참고용으로 쓰이며,
  네이버 글쓰기 API는 본문 이미지 직접 첨부를 지원하지 않아 게시글에 자동 삽입되지 않습니다.
- 네이버 블로그 글쓰기 API는 앱별 권한 승인이 필요하며 정책에 따라 이용 조건이 달라질 수
  있습니다. 실제 발행 전에는 등록한 계정으로 테스트해 보시길 권장합니다.
