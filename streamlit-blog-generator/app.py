import streamlit as st
import google.generativeai as genai
from PIL import Image

# 페이지 설정
st.set_page_config(
    page_title="✨ 짐픽 프리미엄 부동산 블로그 생성기",
    page_icon="🏡",
    layout="wide"
)

# 🌸 화사하고 따뜻한 파스텔톤 디자인 스타일
st.markdown("""
<style>
    .main {
        background-color: #FAF8F5;
    }
    [data-testid="stSidebar"] {
        background-color: #FFF5F7;
    }
    .stButton>button {
        background: linear-gradient(135deg, #FFB6C1 0%, #FFC0CB 100%);
        color: #4A4A4A;
        border: none;
        border-radius: 20px;
        padding: 12px 28px;
        font-weight: 700;
        font-size: 16px;
        box-shadow: 0 4px 10px rgba(255, 182, 193, 0.4);
        transition: all 0.3s ease;
    }
    .stButton>button:hover {
        background: linear-gradient(135deg, #FF91A4 0%, #FFB6C1 100%);
        color: white;
        box-shadow: 0 6px 14px rgba(255, 145, 164, 0.6);
        transform: translateY(-2px);
    }
    h1, h2, h3 {
        color: #5C4033;
        font-family: 'Pretendard', sans-serif;
    }
    .stTextInput>div>div>input, .stTextArea>div>div>textarea {
        border-radius: 12px;
        border: 1px solid #EED7D8;
        background-color: #FFFFFF;
    }
</style>
""", unsafe_allow_html=True)

# API 키 가져오기 (시크릿 마스터 키 연동)
api_key = ""
try:
    if "GEMINI_API_KEY" in st.secrets:
        api_key = st.secrets["GEMINI_API_KEY"]
except Exception:
    pass

# --- 사이드바 설정 (불필요한 기능 제거) ---
with st.sidebar:
    st.markdown("### 🌸 시스템 상태")
    if not api_key:
        api_key = st.text_input("Gemini API 키 입력", type="password")
    else:
        st.success("✨ 마스터 API 키가 안전하게 적용되어 있습니다!")
        
    st.markdown("---")
    st.markdown("### 📞 중개사무소 정보")
    office_name = st.text_input("부동산 상호명", placeholder="예: 🌸 대봉공인중개사사무소")
    agent_name = st.text_input("담당 소장님 성함", placeholder="예: 김대봉 소장")
    agent_phone = st.text_input("연락처 (전화번호)", placeholder="예: 010-1234-5678")
    office_addr = st.text_input("사무소 주소", placeholder="예: 대구 중구 명덕로...")
    
    st.markdown("---")
    st.markdown("<p style='font-size: 12px; color: #888;'>✨ 짐픽 · 공인중개사 전용 AI 솔루션</p>", unsafe_allow_html=True)

# --- 메인 화면 ---
st.markdown("<h1 style='text-align: center; color: #5C4033;'>🏡 프리미엄 부동산 블로그 자동 생성기</h1>", unsafe_allow_html=True)
st.markdown("<p style='text-align: center; color: #7A6252; font-size: 16px;'>매물 사진과 특징을 넣으면, AI가 사진을 분석해 완벽한 블로그 포스팅을 완성해 드립니다! 💖</p>", unsafe_allow_html=True)
st.markdown("---")

# 입력 폼
col1, col2 = st.columns(2)

with col1:
    prop_title = st.text_input("✨ 매물 타이틀 / 단지명", placeholder="예: [급매] 대구 수성구 힐스테이트 34평 올수리 남향")
    prop_price = st.text_input("💰 매물 가격", placeholder="예: 매매 7억 5,000만원 (조정 가능)")

with col2:
    prop_type = st.selectbox("🏠 매물 종류", ["아파트 매매/전세", "상가/사무실", "주택/빌라", "토지/재개발"])

# 사진 업로드 기능
uploaded_files = st.file_uploader("📸 매물 실사진 업로드 (여러 장 선택 가능)", type=["jpg", "jpeg", "png"], accept_multiple_files=True)

if uploaded_files:
    st.markdown(f"<p style='color: #E68294; font-weight: bold;'>✨ 총 {len(uploaded_files)}장의 사진이 업로드되었습니다! AI가 사진을 분석에 활용합니다.</p>", unsafe_allow_html=True)

prop_features = st.text_area("🌟 매물의 핵심 특징 (자세히 적을수록 글이 풍성해집니다!)", placeholder="예:\n- 초역세권 도보 3분 거리\n- 올리모델링 완료로 내부 매우 깨끗함\n- 초·중·고 학세권 완벽\n- 즉시 입주 가능, 주인세대 강추 매물!")

st.markdown("<br>", unsafe_allow_html=True)

# 생성 버튼
generate_btn = st.button("✨ 사진 분석 및 감성 블로그 글 생성하기 💖", use_container_width=True)

if generate_btn:
    if not api_key:
        st.warning("⚠️ API 키를 확인해 주세요!")
    elif not prop_title:
        st.warning("⚠️ 매물 타이틀을 입력해 주세요!")
    else:
        with st.spinner("🌸 업로드된 사진과 정보를 바탕으로 아름다운 블로그 글을 작성 중입니다... 잠시만 기다려주세요! ✨"):
            try:
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                
                prompt = f"""
                당신은 감각적이고 신뢰감을 주는 베테랑 공인중개사 블로거입니다. 
                제공된 매물 정보와 첨부된 사진들을 바탕으로, 네이버 블로그에 최적화된 **길고 상세하며 정감이 가는 프리미엄 블로그 글**을 작성해 주세요.
                
                [매물 정보]
                - 종류: {prop_type}
                - 타이틀: {prop_title}
                - 가격: {prop_price}
                - 핵심 특징: {prop_features}
                
                [작성 가이드라인]
                1. 서론: 따뜻한 인사말과 함께 이 매물이 왜 특별한지 감성적으로 소개해주세요.
                2. 본론: 입지 환경과 첨부된 사진들의 느낌(거실, 주방, 방 등 공간별 장점)을 생생하게 묘사해 주세요.
                3. **사진 삽입 위치 안내**: 글 내용 중간중간에 사진을 넣기 좋도록 `[📸 여기에 거실 사진 삽입]`, `[📸 여기에 주방/방 사진 삽입]` 같은 가이드 문구를 자연스럽게 배치해 주세요.
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
                
                response = model.generate_content(content_inputs)
                
                st.markdown("---")
                st.markdown("### 💌 완성된 프리미엄 블로그 포스팅")
                st.markdown(response.text)
                
                st.success("🎉 사진 분석형 블로그 글이 성공적으로 완성되었습니다! 아래 내용을 복사해서 네이버 블로그에 붙여넣고 사진을 쏙쏙 채워보세요. 💖")
                
            except Exception as e:
                st.error(f"오류가 발생했습니다: {e}")
