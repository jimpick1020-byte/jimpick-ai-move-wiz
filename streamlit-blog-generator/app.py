import streamlit as st
from google import genai
from PIL import Image

st.set_page_config(
    page_title="✨ 짐픽 프리미엄 부동산 블로그 생성기",
    page_icon="🏡",
    layout="wide"
)

st.markdown("""
<style>
    .main { background-color: #FAF8F5; }
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

st.markdown("<h1 style='text-align: center; color: #5C4033;'>🏡 프리미엄 부동산 블로그 자동 생성기</h1>", unsafe_allow_html=True)
st.markdown("<p style='text-align: center; color: #7A6252; font-size: 14px;'>모바일에서도 편리하게 AI 블로그를 생성하세요! 💖</p>", unsafe_allow_html=True)
st.markdown("---")

# 🔑 API 키 자동 불러오기 (st.secrets 지원 + 없으면 입력란 표시)
api_key = ""
try:
    if "GEMINI_API_KEY" in st.secrets:
        api_key = st.secrets["GEMINI_API_KEY"]
except Exception:
    pass

if api_key:
    st.success("✨ API 키가 안전하게 자동 적용되어 있습니다!")
else:
    api_key = st.text_input("🔑 Gemini API 키 입력", type="password", placeholder="여기에 API 키를 입력하세요")

st.markdown("---")
st.markdown("### 📞 중개사무소 정보 입력")
col_info1, col_info2 = st.columns(2)
with col_info1:
    office_name = st.text_input("부동산 상호명", placeholder="예: 대봉공인중개사")
    agent_name = st.text_input("담당자 성함", placeholder="예: 김대봉 소장")
with col_info2:
    agent_phone = st.text_input("연락처", placeholder="예: 010-1234-5678")
    office_addr = st.text_input("사무소 주소", placeholder="예: 대구 중구 명덕로")

st.markdown("---")
st.markdown("### 📝 매물 핵심 정보 입력")

prop_title = st.text_input("아파트/매물 이름", placeholder="예: 대봉 센트럴펠리스")
prop_price = st.text_input("가격 및 조건", placeholder="예: 전세 3억 32평 즉시 입주 저층")
prop_features = st.text_area("✨ 추가 강조 포인트 (선택 사항)", placeholder="예: 올리모델링 했음 학군 좋고 입지 최고")

uploaded_files = st.file_uploader("📸 매물 실사진 업로드 (여러 장 선택 가능)", type=["jpg", "jpeg", "png"], accept_multiple_files=True)

if uploaded_files:
    st.markdown(f"<p style='color: #E68294; font-weight: bold;'>✨ 총 {len(uploaded_files)}장의 사진이 업로드되었습니다!</p>", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

generate_btn = st.button("✨ [실전형] 고품격 블로그 글 뚝딱 완성하기", use_container_width=True)

if generate_btn:
    if not api_key:
        st.warning("⚠️ Gemini API 키를 입력해 주세요!")
    elif not prop_title:
        st.warning("⚠️ 아파트/매물 이름을 입력해 주세요!")
    else:
        with st.spinner("🌸 업로드된 사진과 정보를 바탕으로 블로그 글을 작성 중입니다... 잠시만 기다려주세요! ✨"):
            try:
                # 최신 google-genai SDK 적용
                client = genai.Client(api_key=api_key)

                prompt = f"""
                당신은 감각적이고 신뢰감을 주는 베테랑 공인중개사 블로거입니다.
                제공된 매물 정보와 첨부된 사진들을 바탕으로, 네이버 블로그에 최적화된 길고 상세하며 정감이 가는 프리미엄 블로그 글을 작성해 주세요.

                [매물 정보]
                - 매물 이름: {prop_title}
                - 가격 및 조건: {prop_price}
                - 핵심 특징 및 강조 포인트: {prop_features}

                [작성 가이드라인]
                1. 서론: 따뜻한 인사말과 함께 이 매물이 왜 특별한지 감성적으로 소개해주세요.
                2. 본론: 입지 환경과 첨부된 사진들의 느낌(거실, 주방, 방 등 공간별 장점)을 생생하게 묘사해 주세요.
                3. 사진 삽입 위치 안내: 글 내용 중간중간에 사진을 넣기 좋도록 [📸 여기에 거실 사진 삽입], [📸 여기에 방 사진 삽입] 같은 가이드 문구를 자연스럽게 배치해 주세요.
                4. 결론: 이사 고민 중이신 고객분들께 따뜻한 조언과 함께 방문을 권유하는 메시지를 담아주세요.
                5. 글의 맨 하단에는 아래 중개사무소 정보를 예쁘게 덧붙여주세요.
                - 상호명: {office_name}
                - 담당자: {agent_name}
                - 연락처: {agent_phone}
                - 주소: {office_addr}

                이모지(🌸, 🏡, ✨, 💖 등)를 조화롭게 사용하여 너무 딱딱하지 않고 세련되고 화사한 분위기로 작성해 주세요.
                """

                content_inputs = [prompt]
                if uploaded_files:
                    for file in uploaded_files:
                        img = Image.open(file)
                        content_inputs.append(img)

                response = client.models.generate_content(
                    model='gemini-2.0-flash',
                    contents=content_inputs
                )

                st.markdown("---")
                st.markdown("### 💌 완성된 프리미엄 블로그 포스팅")
                st.markdown(response.text)

                st.success("🎉 블로그 글이 성공적으로 완성되었습니다! 아래 내용을 복사해서 네이버 블로그에 활용해보세요. 💖")

            except Exception as e:
                st.error(f"AI 글쓰기 중 문제가 발생했습니다: {e}")
