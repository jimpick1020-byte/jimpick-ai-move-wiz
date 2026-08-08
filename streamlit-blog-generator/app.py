import json
import os
import uuid

import streamlit as st

import images
import naver

# 페이지 설정
st.set_page_config(
    page_title="✨ 짐픽 프리미엄 부동산 블로그 생성기",
    page_icon="🏡",
    layout="wide",
)

# 사용할 Gemini 모델 (필요시 이 값만 바꾸면 됩니다)
GEMINI_MODEL = "gemini-2.5-flash"

# ---------------------------------------------------------------------------
# 프리미엄 감성 스타일 (핑크/따뜻한 톤)
# ---------------------------------------------------------------------------
st.markdown("""
<style>
    .stApp { background-color: #FAF8F5; }
    .stButton>button {
        background: linear-gradient(135deg, #FFB6C1 0%, #FFC0CB 100%);
        color: #4A4A4A;
        border: none;
        border-radius: 20px;
        padding: 12px 28px;
        font-weight: 700;
        font-size: 16px;
        box-shadow: 0 4px 10px rgba(255, 182, 193, 0.4);
    }
    .stButton>button:hover {
        background: linear-gradient(135deg, #FF91A4 0%, #FFB6C1 100%);
        color: white;
    }
    h1, h2, h3 { color: #5C4033; }
    .stTextInput>div>div>input, .stTextArea>div>div>textarea {
        border-radius: 12px;
        border: 1px solid #EED7D8;
        background-color: #FFFFFF;
    }
</style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# 설정값 읽기 (secrets → 환경변수)
# ---------------------------------------------------------------------------
def get_api_key():
    try:
        for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
            if name in st.secrets:
                return st.secrets[name]
    except Exception:
        pass
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


def get_config_value(name):
    try:
        if name in st.secrets:
            return st.secrets[name]
    except Exception:
        pass
    return os.environ.get(name)


# ---------------------------------------------------------------------------
# AI 글쓰기 (프리미엄 실전 마케팅 프롬프트)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """당신은 감각적이고 신뢰감을 주는 대한민국 최고의 베테랑 공인중개사이자 파워 블로거입니다.
네이버 블로그 독자가 읽고 순식간에 마음을 빼앗겨 **당장 전화하고 싶어지도록**,
길고 상세하며 정감이 가는 프리미엄 매물 소개 포스팅을 작성합니다.

[본문 구성]
1. 서론 — 따뜻한 인사말과 함께 이 매물이 왜 특별한지 감성적으로 소개.
2. 본론 — 입지·학군·교통·구조와 사진 속 공간별 장점(거실·주방·방·뷰 등)을 생생하고 구체적으로 길게 묘사.
3. 추천 대상 — 어떤 분께 최고의 선택이 될지 콕 집어 설명.
4. 결론 CTA — 이사 고민 중인 고객께 따뜻한 조언과 방문 권유로 마무리.

[작성 규칙]
- 사진이 제공되면 사진에서 보이는 특징을 자연스럽게 녹여 씁니다.
- 사진이 2장 이상이면, 본문 흐름상 사진이 들어가면 좋은 위치에
  `[📸 여기에 거실 사진 삽입]` 같은 안내 문구를 2~4곳 자연스럽게 배치하세요.
  (시스템이 이 문구를 실제 사진으로 자동 교체합니다.)
  ※ 대표 사진은 시스템이 글 맨 위에 자동 배치하므로, 맨 처음 위치에는 안내 문구를 넣지 마세요.
- 소제목(■)과 짧은 단락, 목록, 이모지(🌸🏡✨💖 등)를 조화롭게 사용해 화사하고 세련되게.
- 과장·허위는 피하되 매력적으로. 친근하면서 신뢰감 있는 전문적 어조.
- 네이버 검색 노출을 위해 매물 이름과 핵심 조건을 제목·본문에 자연스럽게 포함.
- 상호명·담당자·전화번호·주소 같은 연락처 정보는 본문에 직접 적지 마세요.
  글은 방문을 권유하는 CTA로 마무리하고, 실제 연락처는 시스템이 맨 아래에 자동으로 덧붙입니다."""


def build_user_prompt(prop_title, prop_price, prop_features, office_name, agent_name, prop_type):
    return (
        "다음 매물 정보로 네이버 블로그 프리미엄 매물 소개 포스팅을 작성해 주세요.\n\n"
        f"- 매물 종류: {prop_type}\n"
        f"- 매물 이름: {prop_title}\n"
        f"- 가격 및 조건: {prop_price}\n"
        f"- 핵심 특징 및 강조 포인트: {prop_features if prop_features else '없음'}\n"
        f"- (참고) 중개사무소: {office_name or '친절공인중개사'} / 담당 {agent_name or '대표'}\n"
        "  ※ 위 연락 정보는 본문에 직접 쓰지 말고, 방문 권유 CTA로 마무리해 주세요.\n\n"
        "결과는 반드시 title(제목)과 content(본문) 두 항목을 가진 JSON으로 주세요. "
        "제목은 클릭을 부르는 트렌디한 한 줄로, content 는 소제목과 줄바꿈을 활용해 길고 풍부하게 작성해 주세요."
    )


def generate_with_gemini(api_key, prop_title, prop_price, prop_features,
                         office_name, agent_name, prop_type, uploaded_files):
    """실제 Gemini API를 호출해 (제목, 본문)을 반환합니다. 사진은 멀티모달로 함께 전달합니다."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    parts = [types.Part.from_text(
        text=build_user_prompt(prop_title, prop_price, prop_features, office_name, agent_name, prop_type)
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


def build_contact_block(office_name, agent_name, agent_phone, office_addr):
    """중개사무소 연락처를 보기 좋은 문의 블록으로 만듭니다. (없으면 빈 문자열)"""
    lines = []
    if office_name:
        lines.append(f"🏢 {office_name}")
    if agent_name:
        lines.append(f"👤 {agent_name}")
    if agent_phone:
        lines.append(f"📞 {agent_phone}")
    if office_addr:
        lines.append(f"📍 {office_addr}")
    if not lines:
        return ""
    return "───────────────\n📌 지금 바로 문의주세요! 💖\n" + "\n".join(lines)


def generate_sample(prop_title, prop_price, prop_features):
    """API 키가 없을 때 앱이 계속 동작하도록 하는 예시(샘플) 초안입니다."""
    title = f"🌸 [단독매물] {prop_title} {prop_price}, 놓치면 후회하는 귀한 기회!"
    feat = f"\n■ 특별히 강조할 점\n- {prop_features}\n" if prop_features else ""
    content = f"""안녕하세요! 소중한 보금자리를 찾아드리는 부동산입니다. 😊
오늘은 요즘 문의가 정말 많은 '{prop_title}'를 자신 있게 소개해 드립니다. 🏡

■ 매물 요약
- {prop_price}

[📸 여기에 거실 사진 삽입]

■ 이 집을 꼭 보셔야 하는 이유 ✨
- 채광과 환기가 우수하고 관리상태가 최상입니다.
- 교통·학군·편의시설까지 삼박자를 고루 갖춘 입지입니다.
- 실제로 보시면 사진보다 훨씬 마음에 드실 거예요!
{feat}
[📸 여기에 주방/방 사진 삽입]

■ 이런 분께 추천드립니다 💖
- 실거주와 투자가치를 모두 잡고 싶으신 분
- 즉시 입주가 필요한 분

지금 이 순간에도 문의가 이어지는 귀한 매물이에요.
망설이면 놓칩니다. 지금 바로 편하게 연락 주세요!"""
    return title, content


# ---------------------------------------------------------------------------
# 헤더
# ---------------------------------------------------------------------------
st.markdown("<h1 style='text-align:center;'>🏡 프리미엄 부동산 블로그 자동 생성기</h1>", unsafe_allow_html=True)
st.markdown(
    "<p style='text-align:center; color:#7A6252; font-size:14px;'>"
    "모바일에서도 편리하게, 사진까지 AI가 반영해 네이버 블로그에 바로 발행하세요! 💖</p>",
    unsafe_allow_html=True,
)
st.markdown("---")

# 🔑 Gemini API 키 (상단 배치)
key_from_config = get_api_key()
if key_from_config:
    st.success("🔑 Gemini API 키가 설정되어 있습니다.")
    api_key = key_from_config
else:
    api_key = st.text_input("🔑 Gemini API 키 입력", type="password",
                            placeholder="여기에 API 키를 입력하세요")
    st.caption("키가 없으면 예시(샘플) 글로 미리보기만 제공됩니다.")

# ⚙️ 발행/사진 연동 설정 (선택) — 접이식
with st.expander("🔗 네이버 블로그 자동 발행 설정 (선택)"):
    naver_client_id = get_config_value("NAVER_CLIENT_ID") or st.text_input(
        "네이버 Client ID", key="naver_cid")
    naver_client_secret = get_config_value("NAVER_CLIENT_SECRET") or st.text_input(
        "네이버 Client Secret", type="password", key="naver_csecret")
    naver_redirect_uri = get_config_value("NAVER_REDIRECT_URI") or st.text_input(
        "Redirect URI", value="http://localhost:8501", key="naver_redirect",
        help="네이버 앱에 등록한 콜백 URL과 정확히 같아야 합니다.")
    naver_configured = bool(naver_client_id and naver_client_secret and naver_redirect_uri)
    st.caption("설정하면 실제 네이버 블로그로 발행됩니다. 없으면 연습(시뮬레이션)으로 동작합니다.")

with st.expander("🖼️ 사진 자동 삽입 설정 (선택, imgbb)"):
    imgbb_api_key = get_config_value("IMGBB_API_KEY") or st.text_input(
        "imgbb API 키", type="password", key="imgbb_key",
        help="https://api.imgbb.com 에서 무료 발급. 사진을 게시글에 자동 삽입하려면 필요합니다.")
    st.caption("설정하면 발행 시 업로드한 사진이 글에 자동으로 삽입됩니다.")

st.markdown("---")

# 📞 중개사무소 정보 (연락처 자동 삽입)
st.markdown("### 📞 중개사무소 정보 입력 (연락처 자동 삽입)")
col_info1, col_info2 = st.columns(2)
with col_info1:
    office_name = st.text_input("부동산 상호명", placeholder="예: 대봉공인중개사")
    agent_name = st.text_input("담당자 성함", placeholder="예: 김대봉 소장")
with col_info2:
    agent_phone = st.text_input("연락처", placeholder="예: 010-1234-5678")
    office_addr = st.text_input("사무소 주소", placeholder="예: 대구 중구 명덕로")

st.markdown("---")

# 📝 매물 핵심 정보
st.markdown("### 📝 매물 핵심 정보 입력")
prop_type = st.selectbox("🏠 매물 종류", ["아파트 매매/전세", "상가/사무실", "주택/빌라", "토지/재개발"])
prop_title = st.text_input("아파트/매물 이름", placeholder="예: 대봉 센트럴펠리스")
prop_price = st.text_input("가격 및 조건", placeholder="예: 전세 3억 32평 즉시 입주 저층")
prop_features = st.text_area("✨ 추가 강조 포인트 (선택 사항)",
                             placeholder="예: 올리모델링 완료, 학군 좋고 입지 최고")

uploaded_files = st.file_uploader("📸 매물 실사진 업로드 (여러 장 선택 가능)",
                                  type=["jpg", "jpeg", "png"], accept_multiple_files=True)
if uploaded_files:
    st.markdown(
        f"<p style='color:#E68294; font-weight:bold;'>✨ 총 {len(uploaded_files)}장의 사진이 "
        "업로드되었습니다! (AI가 사진을 직접 보고 글에 반영합니다)</p>",
        unsafe_allow_html=True,
    )

st.markdown("<br>", unsafe_allow_html=True)


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
# 글 생성 버튼
# ---------------------------------------------------------------------------
if st.button("✨ [실전형] 고품격 블로그 글 뚝딱 완성하기", use_container_width=True):
    if not prop_title:
        st.warning("⚠️ 아파트/매물 이름을 입력해 주세요!")
    elif api_key:
        with st.spinner("🌸 업로드된 사진과 정보를 바탕으로 프리미엄 블로그 글을 작성 중입니다... 잠시만요! ✨"):
            try:
                title, content = generate_with_gemini(
                    api_key, prop_title, prop_price, prop_features,
                    office_name, agent_name, prop_type, uploaded_files,
                )
                contact = build_contact_block(office_name, agent_name, agent_phone, office_addr)
                if contact:
                    content = content.rstrip() + "\n\n" + contact
                st.session_state['title'] = title
                st.session_state['content'] = content
                st.session_state['ready'] = True
            except Exception as e:
                st.error(f"AI 글쓰기 중 문제가 발생했습니다. API 키와 인터넷 연결을 확인해 주세요.\n\n상세: {e}")
    else:
        st.warning("⚠️ Gemini API 키가 없어 예시(샘플) 글로 미리보기를 보여드립니다. 실제 AI 글쓰기는 상단에 키를 넣어주세요.")
        title, content = generate_sample(prop_title, prop_price, prop_features)
        contact = build_contact_block(office_name, agent_name, agent_phone, office_addr)
        if contact:
            content = content.rstrip() + "\n\n" + contact
        st.session_state['title'] = title
        st.session_state['content'] = content
        st.session_state['ready'] = True


# ---------------------------------------------------------------------------
# 확인·수정 및 실제 네이버 발행
# ---------------------------------------------------------------------------
if st.session_state.get('ready', False):
    st.markdown("---")
    st.markdown("### 💌 완성된 프리미엄 블로그 포스팅 (확인·수정)")

    final_title = st.text_input("블로그 제목", value=st.session_state['title'])
    final_content = st.text_area(
        "블로그 본문 (연락처가 자동 포함되어 있습니다. [📸 …] 위치에 사진이 자동 삽입됩니다)",
        value=st.session_state['content'], height=420,
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
                    image_urls = []
                    if imgbb_api_key and uploaded_files:
                        with st.spinner("매물 사진을 업로드하는 중입니다..."):
                            image_urls = images.upload_many(imgbb_api_key, uploaded_files)
                        if image_urls:
                            st.caption(f"사진 {len(image_urls)}장 업로드 완료 — 글에 삽입합니다.")
                        else:
                            st.warning("사진 업로드에 실패해 이번 글은 사진 없이 발행합니다.")

                    lead_caption = f"▲ {prop_title} 대표 사진" if prop_title else "▲ 대표 사진"
                    contents_html = naver.build_contents_html(
                        final_content, image_urls, lead_caption=lead_caption,
                    )
                    with st.spinner("네이버 블로그에 글을 발행하는 중입니다..."):
                        result = naver.publish_post(
                            st.session_state["naver_access_token"], final_title, contents_html,
                        )
                    st.success("🎉 성공적으로 사장님 블로그에 글이 발행되었습니다! 💖")
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
            st.success("🎉 (연습) 성공적으로 사장님 블로그에 글이 발행되었습니다! 💖")
            st.balloons()
