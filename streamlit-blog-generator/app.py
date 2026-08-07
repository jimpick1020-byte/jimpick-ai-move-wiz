import json
import os
import uuid

import streamlit as st

import images
import naver

# 페이지 설정 (스마트폰 화면에 최적화)
st.set_page_config(
    page_title="부동산 1분 블로그 비서 (실전 마케팅용)",
    page_icon="🏠",
    layout="centered",
)

# 사용할 Gemini 모델 (필요시 이 값만 바꾸면 됩니다)
GEMINI_MODEL = "gemini-2.5-flash"

# ---------------------------------------------------------------------------
# CSS: 5060 사용자 맞춤형 큰 글씨/버튼 스타일링
# ---------------------------------------------------------------------------
st.markdown("""
    <style>
    .stTextInput input { font-size: 18px !important; height: 48px !important; }
    </style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# 설정값 읽기 (secrets → 환경변수)
# ---------------------------------------------------------------------------
def get_api_key():
    """secrets → 환경변수 순서로 Gemini API 키를 찾습니다."""
    try:
        for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
            if name in st.secrets:
                return st.secrets[name]
    except Exception:
        pass
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


def get_config_value(name):
    """secrets → 환경변수 순으로 설정값을 찾습니다."""
    try:
        if name in st.secrets:
            return st.secrets[name]
    except Exception:
        pass
    return os.environ.get(name)


# ---------------------------------------------------------------------------
# AI 글쓰기 (실전 마케팅용 프롬프트)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """당신은 계약률 1위를 자랑하는 대한민국 최고의 베테랑 공인중개사이자 파워 블로거입니다.
네이버 블로그 독자가 읽고 순식간에 매력에 빠져들어 **당장 전화하고 싶어지도록**,
길고 상세하며 전문적인 매물 소개 포스팅을 작성합니다.

[본문 구성 순서]
1. 도입부 — 현재 부동산 시장 분위기와 이 매물을 꼭 봐야 하는 이유를 감성적이면서도 설득력 있게.
2. 상세 분석 — 입지·학군·교통·구조·예상 거주 가치를 전문가의 시선으로 아주 구체적이고 풍부하게, 길게 서술.
3. 추천 대상 — 어떤 분들에게 이 집이 최고의 선택이 될지 콕 집어 설명.
4. 마무리 CTA — 고객이 망설이지 않고 지금 바로 문의하고 싶어지도록 강하게 유도.

[작성 규칙]
- 사진이 제공되면 사진에서 보이는 특징(구조·채광·인테리어·뷰 등)을 구체적으로 녹여 씁니다.
- 소제목(■)과 짧은 단락, 목록, 이모지를 적절히 활용해 모바일에서 읽기 쉽게 구성합니다.
- 과장·허위 광고는 피하되 매력적으로 소개합니다.
- 말투는 친근하면서도 신뢰감을 주는 전문적인 어조(~요 / ~합니다 체 혼용)로 씁니다.
- 네이버 검색에 잘 노출되도록 매물 이름과 핵심 조건을 제목과 본문에 자연스럽게 포함합니다.
- 상호명·담당자 성함·전화번호 같은 구체적인 연락처 정보는 본문에 직접 적지 마세요.
  글은 '지금 문의하세요' 형태의 자연스러운 유도 문장으로 마무리하고,
  실제 연락처 정보는 시스템이 글 맨 아래에 자동으로 덧붙입니다."""


def build_user_prompt(apt_name, price_info, additional_note, office_name, agent_name):
    return (
        "다음 매물 정보로 네이버 블로그 매물 소개 포스팅을 작성해 주세요.\n\n"
        f"- 매물 이름: {apt_name}\n"
        f"- 가격 및 조건: {price_info}\n"
        f"- 추가 강조 포인트: {additional_note if additional_note else '없음'}\n"
        f"- (참고) 중개사무소: {office_name or '친절공인중개사'} / 담당 {agent_name or '대표'}\n"
        "  ※ 위 연락 정보는 본문에 직접 쓰지 말고, 글은 '지금 문의하세요' 형태의 CTA로 마무리해 주세요.\n\n"
        "결과는 반드시 title(제목)과 content(본문) 두 항목을 가진 JSON으로 주세요. "
        "제목은 클릭을 부르는 트렌디하고 호기심을 자극하는 한 줄로, "
        "content 는 소제목과 줄바꿈을 활용해 길고 풍부하게 작성해 주세요."
    )


def generate_with_gemini(api_key, apt_name, price_info, additional_note,
                         office_name, agent_name, uploaded_files):
    """실제 Gemini API를 호출해 (제목, 본문)을 반환합니다. 사진은 멀티모달로 함께 전달합니다."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    # 텍스트 프롬프트 + (있으면) 사진들을 함께 전달하는 멀티모달 입력 구성
    parts = [types.Part.from_text(
        text=build_user_prompt(apt_name, price_info, additional_note, office_name, agent_name)
    )]
    for f in uploaded_files or []:
        try:
            parts.append(types.Part.from_bytes(data=f.getvalue(), mime_type=f.type or "image/jpeg"))
        except Exception:
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


def build_contact_block(office_name, agent_name, agent_phone):
    """중개사무소 연락처를 보기 좋은 문의 블록으로 만듭니다. (없으면 빈 문자열)"""
    lines = []
    if office_name:
        lines.append(f"🏢 {office_name}")
    if agent_name:
        lines.append(f"👤 {agent_name}")
    if agent_phone:
        lines.append(f"📞 {agent_phone}")
    if not lines:
        return ""
    return "───────────────\n📌 지금 바로 문의주세요!\n" + "\n".join(lines)


def generate_sample(apt_name, price_info, additional_note, office_name, agent_name):
    """API 키가 없을 때 앱이 계속 동작하도록 하는 예시(샘플) 초안입니다."""
    title = f"[단독매물] {apt_name} {price_info}, 지금 아니면 놓치는 귀한 기회!"
    note = f"\n■ 특별히 강조할 점\n- {additional_note}\n" if additional_note else ""
    content = f"""안녕하세요! {office_name or '친절공인중개사'}입니다. 😊
오늘은 요즘 문의가 정말 많은 '{apt_name}' 매물을 자신 있게 소개해 드립니다.

■ 매물 요약
- {price_info}

■ 이 집을 꼭 보셔야 하는 이유
- 채광과 환기가 우수하고 관리상태가 최상입니다.
- 교통·학군·편의시설까지 삼박자를 고루 갖춘 입지입니다.
- 실제로 보시면 사진보다 훨씬 마음에 드실 겁니다!
{note}
■ 이런 분께 추천드립니다
- 실거주와 투자가치를 모두 잡고 싶으신 분
- 즉시 입주가 필요한 분

지금 이 순간에도 문의가 이어지고 있는 귀한 매물입니다.
망설이면 놓칩니다. 지금 바로 편하게 연락 주세요!"""
    return title, content


# ---------------------------------------------------------------------------
# 사이드바: API 및 중개사무소/연동 설정
# ---------------------------------------------------------------------------
with st.sidebar:
    st.header("⚙️ 실전 설정 및 API")

    # Gemini API Key
    key_from_config = get_api_key()
    if key_from_config:
        st.success("Gemini API 키가 설정되어 있습니다.")
        gemini_key = key_from_config
    else:
        gemini_key = st.text_input("Gemini API 키", type="password", placeholder="AI 스튜디오 키 입력")
        st.caption("키가 없으면 예시(샘플) 글로 미리보기만 제공됩니다.")

    st.markdown("---")
    st.subheader("📞 중개사무소 정보 (연락처 자동 삽입)")
    office_name = st.text_input("부동산 상호명", placeholder="예: 대봉최고공인중개사사무소")
    agent_name = st.text_input("담당 소장님 성함", placeholder="예: 김대봉 소장")
    agent_phone = st.text_input("연락처 (전화번호)", placeholder="예: 010-1234-5678")

    st.markdown("---")
    st.subheader("🔗 네이버 블로그 자동 발행")
    naver_client_id = get_config_value("NAVER_CLIENT_ID") or st.text_input(
        "네이버 Client ID", key="naver_cid")
    naver_client_secret = get_config_value("NAVER_CLIENT_SECRET") or st.text_input(
        "네이버 Client Secret", type="password", key="naver_csecret")
    naver_redirect_uri = get_config_value("NAVER_REDIRECT_URI") or st.text_input(
        "Redirect URI", value="http://localhost:8501", key="naver_redirect",
        help="네이버 앱에 등록한 콜백 URL과 정확히 같아야 합니다.")
    naver_configured = bool(naver_client_id and naver_client_secret and naver_redirect_uri)
    if naver_configured:
        st.success("네이버 앱 설정 준비 완료.")
    else:
        st.caption("설정이 없으면 발행은 시뮬레이션(연습)으로 동작합니다.")

    st.markdown("---")
    st.subheader("🖼️ 사진 자동 삽입 (imgbb)")
    imgbb_api_key = get_config_value("IMGBB_API_KEY") or st.text_input(
        "imgbb API 키", type="password", key="imgbb_key",
        help="https://api.imgbb.com 에서 무료 발급. 사진을 게시글에 자동 삽입하려면 필요합니다.")
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
                naver_client_id, naver_client_secret,
                _qp.get("code"), _qp.get("state", ""),
            )
            st.session_state["naver_access_token"] = token
            st.query_params.clear()
            st.toast("네이버 로그인 완료! 이제 발행할 수 있습니다.", icon="✅")
        except Exception as e:
            st.error(f"네이버 로그인 처리 중 오류가 발생했습니다: {e}")


# ---------------------------------------------------------------------------
# 메인 화면
# ---------------------------------------------------------------------------
st.title("🏠 부동산 1분 블로그 마케팅 비서")
st.markdown("소장님, 현장에서 찍은 사진과 기본 정보만 넣으세요. **고객의 마음을 사로잡는 고품격 블로그 포스팅**을 완성해 드립니다!")
st.markdown("---")

# 1단계: 사진 업로드
st.subheader("📸 1단계. 현장 매물 사진 업로드 (여러 장 가능)")
uploaded_files = st.file_uploader(
    "매물의 장점(뷰, 인테리어, 구조 등)이 잘 드러난 사진을 올려주세요.",
    type=["jpg", "jpeg", "png"], accept_multiple_files=True,
)
if uploaded_files:
    st.success(f"사진 {len(uploaded_files)}장이 안전하게 등록되었습니다! (AI가 사진을 직접 보고 글에 반영합니다)")

st.markdown("---")

# 2단계: 매물 핵심 정보
st.subheader("📝 2단계. 매물 핵심 정보 입력")
col1, col2 = st.columns(2)
with col1:
    apt_name = st.text_input("아파트/매물 이름", placeholder="예: 대봉 센트럴펠리스")
with col2:
    price_info = st.text_input("가격 및 조건", placeholder="예: 매매 4억 3천, 32평, 저층, 즉시입주")
additional_note = st.text_area(
    "✨ 추가 강조 포인트 (선택 사항)",
    placeholder="예: 올리모델링 완료, 남향이라 채광 극대화, 초중고 도보 5분 거리 등 자랑할 점을 적어주세요.",
)

st.markdown("---")

# 3단계: 블로그 글 생성
if st.button("✨ [실전형] 고품격 블로그 글 뚝딱 완성하기", type="primary", use_container_width=True):
    if not (apt_name and price_info):
        st.warning("아파트 이름과 가격 정보는 필수 입력 항목입니다.")
    elif gemini_key:
        with st.spinner("🧠 손님의 마음을 사로잡을 명품 블로그 글을 작성 중입니다... 잠시만 기다려주세요!"):
            try:
                title, content = generate_with_gemini(
                    gemini_key, apt_name, price_info, additional_note,
                    office_name, agent_name, uploaded_files,
                )
                contact = build_contact_block(office_name, agent_name, agent_phone)
                if contact:
                    content = content.rstrip() + "\n\n" + contact
                st.session_state['title'] = title
                st.session_state['content'] = content
                st.session_state['ready'] = True
            except Exception as e:
                st.error(f"AI 글쓰기 중 문제가 발생했습니다. API 키와 인터넷 연결을 확인해 주세요.\n\n상세: {e}")
    else:
        st.warning("Gemini API 키가 없어 예시(샘플) 글로 미리보기를 보여드립니다. 실제 AI 글쓰기는 사이드바에 키를 넣어주세요.")
        title, content = generate_sample(apt_name, price_info, additional_note, office_name, agent_name)
        contact = build_contact_block(office_name, agent_name, agent_phone)
        if contact:
            content = content.rstrip() + "\n\n" + contact
        st.session_state['title'] = title
        st.session_state['content'] = content
        st.session_state['ready'] = True

# 4단계: 확인·수정 및 실제 네이버 발행
if st.session_state.get('ready', False):
    st.markdown("---")
    st.subheader("🔍 3단계. 완성된 블로그 포스팅 확인 및 수정")

    final_title = st.text_input("블로그 제목", value=st.session_state['title'])
    final_content = st.text_area(
        "블로그 본문 내용 (연락처가 자동으로 포함되어 있습니다)",
        value=st.session_state['content'], height=400,
    )

    st.markdown("<br>", unsafe_allow_html=True)

    if naver_configured:
        if "naver_access_token" in st.session_state:
            st.info("네이버 계정이 연결되었습니다. 아래 버튼을 누르면 실제로 발행됩니다.")
            if imgbb_api_key and uploaded_files:
                st.caption(f"발행 시 사진 {len(uploaded_files)}장을 글에 자동으로 삽입합니다.")
            elif uploaded_files and not imgbb_api_key:
                st.caption("※ imgbb 키가 없어 사진은 삽입되지 않고 글만 발행됩니다.")

            if st.button("🚀 내 네이버 블로그에 지금 바로 발행하기", key="publish", use_container_width=True):
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
                    lead_caption = f"▲ {apt_name} 대표 사진" if apt_name else "▲ 대표 사진"
                    contents_html = naver.build_contents_html(
                        final_content, image_urls, lead_caption=lead_caption,
                    )
                    with st.spinner("네이버 블로그에 글을 발행하는 중입니다..."):
                        result = naver.publish_post(
                            st.session_state["naver_access_token"], final_title, contents_html,
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
            if "naver_oauth_state" not in st.session_state:
                st.session_state["naver_oauth_state"] = uuid.uuid4().hex
            auth_url = naver.get_authorize_url(
                naver_client_id, naver_redirect_uri, st.session_state["naver_oauth_state"],
            )
            st.warning("발행하려면 먼저 네이버 계정으로 로그인해야 합니다.")
            st.link_button("🔐 네이버 로그인하고 발행 준비하기", auth_url, use_container_width=True)
    else:
        st.caption("※ 네이버 앱 설정이 없어 아래 버튼은 연습(시뮬레이션)으로 동작합니다.")
        if st.button("🚀 내 네이버 블로그에 지금 바로 발행하기 (연습)", key="publish_sim", use_container_width=True):
            st.success("🎉 (연습) 성공적으로 사장님 블로그에 글이 발행되었습니다!")
            st.balloons()
