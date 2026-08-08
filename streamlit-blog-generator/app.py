# app.py
import streamlit as st
import google.generativeai as genai

# 페이지 설정
st.set_page_config(
    page_title="부동산 블로그 자동 생성기",
    page_icon="🏠",
    layout="wide"
)

# 사이드바 설정 (API 키 및 공인중개사 정보 입력)
with st.sidebar:
    st.header("⚙️ 설정 및 프로필")
    
    # 1. API 키 입력
    api_key = st.text_input("Gemini API Key 입력", type="password", help="Google AI Studio에서 발급받은 키를 입력하세요.")
    
    st.divider()
    st.subheader("🏢 부동산 정보 (하단 자동 삽입)")
    
    # 2. 부동산 상호명, 담당자, 연락처 입력
    agency_name = st.text_input("부동산 상호명", value="스타 공인중개사사무소")
    agent_name = st.text_input("대표/담당자 성함", value="김소장")
    phone_number = st.text_input("연락처 (전화번호)", value="010-0000-0000")
    office_address = st.text_input("사무소 주소", value="대구광역시 OO구 OO로 123")
    
    st.markdown("---")
    st.info("💡 **팁:** 키를 입력하고 아래 매물 정보를 입력하면, 네이버 블로그에 최적화된 **길고 상세한 프리미엄 글**이 자동으로 생성됩니다!")

# 메인 화면
st.title("🏠 프리미엄 부동산 블로그 글 자동 생성기")
st.markdown("매물 정보만 간단히 입력하시면, 고객의 마음을 사로잡는 **상세하고 설득력 있는 블로그 포스팅**이 완성됩니다.")

# 입력 폼
col1, col2 = st.columns(2)

with col1:
    property_title = st.text_input("매물 한줄 요약 제목", placeholder="예: 대구 수성구 역세권 신축급 3룸 올리모델링 전세")
    property_type = st.selectbox("매물 종류", ["아파트", "빌라/다세대", "오피스텔", "상가/사무실", "토지", "단독주택/원룸"])
    deal_type = st.selectbox("거래 형태", ["매매", "전세", "월세", "단기임대"])
    price = st.text_input("가격 (보증금/월세/매매가)", placeholder="예: 보증금 3억 / 월세 50만 원 또는 매매 5억 5천")

with col2:
    area = st.text_input("면적 / 공급면적", placeholder="예: 공급 112㎡ / 전용 84㎡ (34평형)")
    floor = st.text_input("해당 층 / 총 층수", placeholder="예: 5층 / 총 15층")
    direction = st.text_input("방향 (거실 기준)", placeholder="예: 남향 (채광 아주 우수)")
    move_in = st.text_input("입주 가능일", placeholder="예: 즉시 입주 가능 또는 협의 가능")

features = st.text_area("🌟 매물 핵심 특징 및 장점 (자세히 적을수록 글이 길고 풍부해집니다)", 
                         placeholder="예: - 초역세권 도보 3분 거리\n- 대형마트 및 병원 인접\n- 올리모델링 완료로 손볼 곳 없음\n- 훌륭한 학군과 조용한 주거 환경",
                         height=120)

# 생성 버튼
if st.button("🚀 블로그 글 길고 상세하게 생성하기", type="primary", use_container_width=True):
    if not api_key:
        st.error("⚠️ 사이드바에 Gemini API Key를 먼저 입력해 주세요!")
    elif not property_title:
        st.warning("⚠️ 매물 제목을 입력해 주세요.")
    else:
        with st.spinner("✨ 고객의 마음을 사로잡는 고품격 블로그 포스팅을 작성 중입니다... (잠시만 기다려주세요)"):
            try:
                # Gemini API 설정
                genai.configure(api_key=api_key)
                
                # 모델 선택 (gemini-2.5-flash 또는 안정적인 1.5-flash)
                model_name = "gemini-2.5-flash"
                try:
                    model = genai.GenerativeModel(model_name)
                except:
                    model = genai.GenerativeModel("gemini-1.5-flash")

                # 길고 상세한 작성을 유도하는 강력한 프롬프트 작성
                prompt = f"""
                당신은 계약률 1위의 베테랑 부동산 전문 블로거이자 공인중개사입니다. 
                아래의 매물 정보를 바탕으로, 네이버 블로그에 게시할 **매우 상세하고 분량이 길며(공백 포함 1500자 이상 분량 느낌), 가독성이 뛰어난 프리미엄 블로그 포스팅**을 작성해 주세요.

                [매물 기본 정보]
                - 제목: {property_title}
                - 매물 종류: {property_type} ({deal_type})
                - 가격: {price}
                - 면적: {area}
                - 층수: {floor}
                - 방향: {direction}
                - 입주 가능일: {move_in}
                - 핵심 특징: {features}

                [작성 가이드라인]
                1. **서론:** 고객의 이목을 끄는 매력적인 인사말과 함께, 현재 해당 지역 부동산 시장 분위기 및 이 매물이 왜 특별한지 감성적이면서도 전문적으로 어필해주세요.
                2. **본론 1 (상세 매물 분석):** 면적, 구조, 층수, 방향 등 실거주 관점에서 중요한 점들을 상세히 풀어 설명해주세요.
                3. **본론 2 (입지 및 인프라):** 교통(역세권 등), 학군, 편의시설, 주변 환경의 장점을 상세히 묘사해 주세요.
                4. **본론 3 (소장님 추천 포인트):** 이 매물이 어떤 분(신혼부부, 투자자, 대가족 등)에게 딱 맞는 맞춤 매물인지 구체적인 이유를 들어 추천해 주세요.
                5. **결론 및 마무리:** 따뜻하고 신뢰감을 주는 어조로 마무리하고, 아래의 중개사무소 정보를 보기 좋게 강조하여 배치해 주세요.
                6. **형식:** 이모지(Emoji)를 적절히 활용하여 시각적으로 깔끔하고 지루하지 않게 구성해 주세요. 소제목(### 또는 ####)을 적극 활용해 주세요.

                [하단 고정 중개사무소 정보 (반드시 포함)]
                - 상호명: {agency_name}
                - 대표/담당자: {agent_name}
                - 연락처: {phone_number}
                - 사무소 주소: {office_address}
                """

                response = model.generate_content(prompt)
                
                st.success("🎉 고품격 블로그 포스팅이 성공적으로 완성되었습니다!")
                st.markdown("---")
                
                # 결과 출력
                st.markdown(response.text)
                
                st.markdown("---")
                st.download_button(
                    label="📥 블로그 글 텍스트 다운로드",
                    data=response.text,
                    file_name=f"부동산블로그_{property_title[:10]}.txt",
                    mime="text/plain"
                )

            except Exception as e:
                st.error(f"❌ 오류가 발생했습니다: {e}")
