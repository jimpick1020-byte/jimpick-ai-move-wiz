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

## 참고

- 3단계 글 생성은 이제 실제 Gemini AI가 담당합니다(사진 멀티모달 반영).
- 4단계 발행은 아직 시뮬레이션(성공 메시지)입니다. 실제 네이버 블로그 발행 연동은
  다음 단계에서 붙일 수 있습니다.
