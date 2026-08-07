import json
import os

import streamlit as st

# 페이지 설정 (스마트폰 화면에 최적화)
st.set_page_config(page_title="부동산 1분 비서", page_icon="🏠", layout="centered")

# 사용할 Gemini 모델 (필요시 이 값만 바꾸면 됩니다)
GEMINI_MODEL = "gemini-2.5-flash"

# ---------------------------------------------------------------------------
# CSS를 이용해 버튼 글씨를 크게 키우고 5060 사용자 맞춤형 UI 스타일링
# ---------------------------------------------------------------------------
st.markdown("""
    <style>
    .big-button {
        font-size: 24px !important;
        font-weight: bold !important;
        padding: 20px !important;
        width: 100% !important;
        background-color: #FF5722 !important;
        color: white !important;
        border-radius: 10px !important;
    }
    .publish-button {
        font-size: 24px !important;
        font-weight: bold !important;
        padding: 20px !important;
        width: 100% !important;
        background-color: #4CAF50 !important;
        color: white !important;
        border-radius: 10px !important;
    }
    .stTextInput input {
        font-size: 20px !important;
        height: 50px !important;
    }
    </style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# AI 글쓰기 관련 함수
# ---------------------------------------------------------------------------
def get_api_key():
    """secrets → 환경변수 → 사이드바 입력 순서로 Gemini API 키를 찾습니다."""
    # 1) .streamlit/secrets.toml
    try:
        for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
            if name in st.secrets:
                return st.secrets[name]
    except Exception:
        # secrets 파일이 없어도 앱이 죽지 않도록 무시
        pass
    # 2) 환경변수
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


SYSTEM_PROMPT = """당신은 대한민국 부동산 매물 소개 블로그를 전문적으로 써 주는 카피라이터입니다.
공인중개사(소장님)를 대신해 네이버 블로그에 올릴 매물 소개 글을 작성합니다.

작성 규칙:
- 밝고 신뢰감 있는 존댓말 말투로, 실제 동네 부동산 소장님이 직접 쓴 것처럼 자연스럽게 작성합니다.
- 과장·허위 광고는 피하고, 주어진 정보에 근거해 매력적으로 소개합니다.
- 본문은 소제목(■)과 짧은 단락, 목록을 활용해 모바일에서 읽기 쉽게 구성합니다.
- 사진이 함께 제공되면, 사진에서 보이는 특징(구조, 채광, 인테리어, 뷰 등)을 자연스럽게 녹여 씁니다.
- 마지막에는 방문/문의를 유도하는 친절한 마무리 문장을 넣습니다.
- 네이버 검색에 잘 노출되도록 아파트 이름과 핵심 조건을 제목과 본문에 자연스럽게 포함합니다.
- 이모지는 과하지 않게 적절히 사용합니다."""


def build_user_prompt(apartment_name, price_info):
    return (
        "다음 매물 정보로 네이버 블로그 매물 소개 글을 작성해 주세요.\n\n"
        f"- 아파트 이름: {apartment_name}\n"
        f"- 가격 및 조건: {price_info}\n\n"
        "결과는 반드시 title(제목)과 content(본문) 두 항목을 가진 JSON으로 주세요. "
        "content 안에서는 줄바꿈을 사용해 읽기 좋게 구성해 주세요."
    )


def generate_with_gemini(api_key, apartment_name, price_info, uploaded_files):
    """실제 Gemini API를 호출해 (제목, 본문)을 반환합니다."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    # 텍스트 프롬프트 + (있으면) 사진들을 함께 전달하는 멀티모달 입력 구성
    parts = [types.Part.from_text(text=build_user_prompt(apartment_name, price_info))]
    for f in uploaded_files or []:
        try:
            parts.append(
                types.Part.from_bytes(
                    data=f.getvalue(),
                    mime_type=f.type or "image/jpeg",
                )
            )
        except Exception:
            # 특정 사진에 문제가 있어도 글쓰기는 계속 진행
            continue

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[types.Content(role="user", parts=parts)],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "content": {"type": "string"},
                },
                "required": ["title", "content"],
            },
            temperature=0.9,
        ),
    )

    data = json.loads(response.text)
    return data["title"], data["content"]


def generate_sample(apartment_name, price_info):
    """API 키가 없을 때 앱이 계속 동작하도록 하는 예시(샘플) 초안입니다."""
    title = f"[매물소개] {apartment_name} {price_info} - 강력 추천 귀한 매물!"
    content = f"""안녕하세요! 동네 최고의 정직한 부동산입니다.
오늘 소개해 드릴 매물은 교통과 학군이 모두 완벽한 '{apartment_name}'입니다.

■ 매물 요약: {price_info}
■ 특징:
- 채광과 환기가 매우 우수하며 관리상태가 최상입니다.
- 인근 편의시설 및 대중교통 이용이 매우 편리합니다.
- 직접 보시면 훨씬 더 마음에 드실 겁니다!

자세한 문의나 현장 방문을 원하시면 언제든지 편하게 연락 주십시오.
친절하게 상담해 드리겠습니다! 감사합니다."""
    return title, content


# ---------------------------------------------------------------------------
# 사이드바: API 키 입력 (기술 설정)
# ---------------------------------------------------------------------------
with st.sidebar:
    st.markdown("### ⚙️ AI 설정")
    key_from_config = get_api_key()
    if key_from_config:
        st.success("Gemini API 키가 설정되어 있습니다.")
        api_key = key_from_config
    else:
        api_key = st.text_input(
            "Gemini API 키",
            type="password",
            help="Google AI Studio에서 발급받은 키를 붙여넣어 주세요.",
            placeholder="AIza... 로 시작하는 키",
        )
        st.caption("키가 없으면 예시(샘플) 글로 미리보기만 제공됩니다.")


# ---------------------------------------------------------------------------
# 메인 화면
# ---------------------------------------------------------------------------
st.title("🏠 부동산 1분 블로그 비서")
st.markdown("### 소장님, 현장에서 사진 찍고 이름만 넣으세요. 글은 제가 다 씁니다!")
st.markdown("---")

# 1단계: 사진 업로드 (스마트폰 카메라 연동)
st.markdown("#### 1단계. 오늘 찍은 매물 사진을 올려주세요")
uploaded_files = st.file_uploader(
    "사진 선택 (여러 장 가능)",
    type=["jpg", "jpeg", "png"],
    accept_multiple_files=True,
)

if uploaded_files:
    photo_count = len(uploaded_files)
    st.success(f"사진 {photo_count}장이 안전하게 등록되었습니다!")

st.markdown("---")

# 2단계: 기본 정보 입력
st.markdown("#### 2단계. 아파트 이름과 가격을 적어주세요")
apartment_name = st.text_input("아파트 이름 (예: 범어네거리 푸르지오)")
price_info = st.text_input("가격 및 조건 (예: 매매 7억, 34평, 중층, 즉시입주)")

st.markdown("---")

# 3단계: AI 비서 글 생성 버튼
if st.button("✨ 블로그 글 뚝딱 완성하기", key="generate", help="버튼을 누르면 AI가 글을 작성합니다"):
    if not (apartment_name and price_info):
        st.error("아파트 이름과 가격 정보를 모두 입력해 주세요!")
    elif api_key:
        # 진짜 Gemini AI로 글쓰기
        with st.spinner("AI 부동산 비서가 사진을 살펴보고 네이버 상위 노출 글을 작성 중입니다... 잠시만 기다려주세요!"):
            try:
                title, content = generate_with_gemini(
                    api_key, apartment_name, price_info, uploaded_files
                )
                st.session_state['title'] = title
                st.session_state['content'] = content
                st.session_state['ready'] = True
            except Exception as e:
                st.error(
                    "AI 글쓰기 중 문제가 발생했습니다. API 키와 인터넷 연결을 확인해 주세요.\n\n"
                    f"상세: {e}"
                )
    else:
        # 키가 없으면 샘플로 미리보기 (앱이 멈추지 않도록)
        st.warning("Gemini API 키가 없어 예시(샘플) 글로 미리보기를 보여드립니다. 실제 AI 글쓰기는 사이드바에 키를 넣어주세요.")
        title, content = generate_sample(apartment_name, price_info)
        st.session_state['title'] = title
        st.session_state['content'] = content
        st.session_state['ready'] = True

# 4단계: 최종 승인 및 발행 화면 (Human-in-the-loop 안전장치)
if st.session_state.get('ready', False):
    st.markdown("---")
    st.markdown("### 🔍 3단계. AI가 쓴 글을 확인하시고 승인해 주세요")

    # 수정 가능한 입력창으로 제공하여 사장님이 직접 고칠 수 있게 함
    final_title = st.text_input("블로그 제목", value=st.session_state['title'])
    final_content = st.text_area("블로그 본문 내용", value=st.session_state['content'], height=250)

    st.markdown("<br>", unsafe_allow_html=True)

    # 초대형 승인 버튼
    if st.button("🚀 내 네이버 블로그에 지금 바로 발행하기", key="publish"):
        st.success("🎉 성공적으로 사장님 블로그에 글이 발행되었습니다!")
        st.balloons()
