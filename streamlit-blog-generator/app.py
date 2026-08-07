import json
import os
import uuid

import streamlit as st

import images
import naver

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


def get_config_value(name):
    """secrets → 환경변수 순으로 설정값을 찾습니다."""
    try:
        if name in st.secrets:
            return st.secrets[name]
    except Exception:
        pass
    return os.environ.get(name)


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

    st.markdown("---")
    st.markdown("### 📤 네이버 발행 설정")
    naver_client_id = get_config_value("NAVER_CLIENT_ID") or st.text_input(
        "네이버 Client ID", key="naver_cid",
        help="네이버 개발자센터에 등록한 앱의 Client ID",
    )
    naver_client_secret = get_config_value("NAVER_CLIENT_SECRET") or st.text_input(
        "네이버 Client Secret", type="password", key="naver_csecret",
    )
    naver_redirect_uri = get_config_value("NAVER_REDIRECT_URI") or st.text_input(
        "Redirect URI", value="http://localhost:8501", key="naver_redirect",
        help="네이버 앱에 등록한 콜백 URL과 정확히 같아야 합니다.",
    )
    naver_configured = bool(naver_client_id and naver_client_secret and naver_redirect_uri)
    if naver_configured:
        st.success("네이버 앱 설정이 준비되었습니다.")
    else:
        st.caption("설정이 없으면 발행은 시뮬레이션(연습)으로 동작합니다.")

    st.markdown("---")
    st.markdown("### 🖼️ 사진 자동 삽입 (imgbb)")
    imgbb_api_key = get_config_value("IMGBB_API_KEY") or st.text_input(
        "imgbb API 키", type="password", key="imgbb_key",
        help="https://api.imgbb.com 에서 무료 발급. 사진을 게시글에 자동 삽입하려면 필요합니다.",
    )
    if imgbb_api_key:
        st.caption("발행 시 업로드한 사진을 자동으로 글에 삽입합니다.")
    else:
        st.caption("키가 없으면 사진 없이 글만 발행됩니다.")


# ---------------------------------------------------------------------------
# 네이버 로그인 콜백 처리: ?code=...&state=... 로 돌아오면 토큰으로 교환
# ---------------------------------------------------------------------------
_qp = st.query_params
if "code" in _qp and "naver_access_token" not in st.session_state:
    if naver_configured:
        try:
            token = naver.exchange_code_for_token(
                naver_client_id,
                naver_client_secret,
                _qp.get("code"),
                _qp.get("state", ""),
            )
            st.session_state["naver_access_token"] = token
            st.query_params.clear()  # 주소창의 code 를 정리
            st.toast("네이버 로그인 완료! 이제 발행할 수 있습니다.", icon="✅")
        except Exception as e:
            st.error(f"네이버 로그인 처리 중 오류가 발생했습니다: {e}")


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

    # 4단계: 실제 네이버 블로그 발행
    if naver_configured:
        if "naver_access_token" in st.session_state:
            # 이미 로그인됨 → 실제 발행 버튼
            st.info("네이버 계정이 연결되었습니다. 아래 버튼을 누르면 실제로 발행됩니다.")
            if imgbb_api_key and uploaded_files:
                st.caption(f"발행 시 사진 {len(uploaded_files)}장을 글에 자동으로 삽입합니다.")
            elif uploaded_files and not imgbb_api_key:
                st.caption("※ imgbb 키가 없어 사진은 삽입되지 않고 글만 발행됩니다.")

            if st.button("🚀 내 네이버 블로그에 지금 바로 발행하기", key="publish"):
                try:
                    # 1) 사진을 이미지 호스팅에 올려 URL 확보 (키가 있고 사진이 있을 때만)
                    image_urls = []
                    if imgbb_api_key and uploaded_files:
                        with st.spinner("매물 사진을 업로드하는 중입니다..."):
                            image_urls = images.upload_many(imgbb_api_key, uploaded_files)
                        if image_urls:
                            st.caption(f"사진 {len(image_urls)}장 업로드 완료 — 글에 삽입합니다.")
                        else:
                            st.warning("사진 업로드에 실패해 이번 글은 사진 없이 발행합니다.")

                    # 2) 본문 + 사진을 HTML로 합쳐 발행 (대표 사진 캡션: ▲ [매물명] 대표 사진)
                    lead_caption = f"▲ {apartment_name} 대표 사진" if apartment_name else "▲ 대표 사진"
                    contents_html = naver.build_contents_html(
                        final_content,
                        image_urls,
                        lead_caption=lead_caption,
                    )
                    with st.spinner("네이버 블로그에 글을 발행하는 중입니다..."):
                        result = naver.publish_post(
                            st.session_state["naver_access_token"],
                            final_title,
                            contents_html,
                        )
                    st.success("🎉 성공적으로 사장님 블로그에 글이 발행되었습니다!")
                    if result.get("url"):
                        st.markdown(f"👉 [발행된 글 바로 보기]({result['url']})")
                    st.balloons()
                except Exception as e:
                    st.error(
                        "발행 중 문제가 발생했습니다. 네이버 앱 권한(블로그 글쓰기)과 "
                        f"로그인 상태를 확인해 주세요.\n\n상세: {e}"
                    )
        else:
            # 로그인 필요 → 네이버 로그인 링크 제공
            if "naver_oauth_state" not in st.session_state:
                st.session_state["naver_oauth_state"] = uuid.uuid4().hex
            auth_url = naver.get_authorize_url(
                naver_client_id,
                naver_redirect_uri,
                st.session_state["naver_oauth_state"],
            )
            st.warning("발행하려면 먼저 네이버 계정으로 로그인해야 합니다.")
            st.link_button("🔐 네이버 로그인하고 발행 준비하기", auth_url)
    else:
        # 네이버 앱 설정이 없으면 연습(시뮬레이션) 발행
        st.caption("※ 네이버 앱 설정이 없어 아래 버튼은 연습(시뮬레이션)으로 동작합니다.")
        if st.button("🚀 내 네이버 블로그에 지금 바로 발행하기 (연습)", key="publish_sim"):
            st.success("🎉 (연습) 성공적으로 사장님 블로그에 글이 발행되었습니다!")
            st.balloons()
