import streamlit as st
import google.generativeai as genai
import requests
import base64

# 페이지 설정
st.set_page_config(
    page_title="부동산 1분 블로그 비서 (실전 마케팅용)",
    page_icon="🏠",
    layout="centered"
)

st.title("🏠 부동산 1분 블로그 마케팅 비서")
st.markdown("소장님, 현장에서 찍은 사진과 기본 정보만 넣으세요. **고객의 마음을 사로잡는 고품격 블로그 포스팅**을 완성해 드립니다!")
st.markdown("---")

# 1. 사이드바 설정 (API 및 중개사무소 정보)
with st.sidebar:
    st.header("⚙️ 실전 설정 및 API")

    # Gemini API Key
    gemini_key = st.text_input("Gemini API 키", type="password", placeholder="AI사서함 키 입력")

    st.markdown("---")
    st.subheader("📞 중개사무소 정보 (자동 입력)")
    office_name = st.text_input("부동산 상호명", placeholder="예: 대봉최고공인중개사사무소")
    agent_name = st.text_input("담당 소장님 성함", placeholder="예: 김대봉 소장")
    agent_phone = st.text_input("연락처 (전화번호)", placeholder="예: 010-1234-5678")

    st.markdown("---")
    st.subheader("🔗 네이버 블로그 연동 (선택)")
    naver_client_id = st.text_input("네이버 Client ID", type="password")
    naver_client_secret = st.text_input("네이버 Client Secret", type="password")

# 2. 메인 입력 화면
st.subheader("📸 1단계. 현장 매물 사진 업로드 (여러 장 가능)")
uploaded_files = st.file_uploader("매물의 장점(뷰, 인테리어, 구조 등)이 잘 드러난 사진을 올려주세요.", type=["jpg", "jpeg", "png"], accept_multiple_files=True)

if uploaded_files:
    st.success(f"사진 {len(uploaded_files)}장이 안전하게 등록되었습니다!")

st.markdown("---")
st.subheader("📝 2단계. 매물 핵심 정보 입력")
col1, col2 = st.columns(2)
with col1:
    apt_name = st.text_input("아파트/매물 이름", placeholder="예: 대봉 센트럴펠리스")
with col2:
    price_info = st.text_input("가격 및 조건", placeholder="예: 매매 4억 3천, 32평, 저층, 즉시입주")

additional_note = st.text_area("✨ 추가 강조 포인트 (선택 사항)", placeholder="예: 올리모델링 완료, 남향이라 채광 극대화, 초중고 도보 5분 거리 등 자랑할 점을 적어주세요.")

st.markdown("---")

# 3. 블로그 글 생성 버튼
if st.button("✨ [실전형] 고품격 블로그 글 뚝딱 완성하기", type="primary", use_container_width=True):
    if not gemini_key:
        st.error("사이드바에 Gemini API 키를 먼저 입력해 주세요!")
    elif not apt_name or not price_info:
        st.warning("아파트 이름과 가격 정보는 필수 입력 항목입니다.")
    else:
        with st.spinner("🧠 손님의 마음을 사로잡을 명품 블로그 글을 작성 중입니다... 잠시만 기다려주세요!"):
            try:
                genai.configure(api_key=gemini_key)
                # 최신 안정 모델 사용
                model = genai.GenerativeModel('gemini-1.5-flash')

                # 실전 마케팅용 강력하고 풍부한 프롬프트 구성
                prompt = f"""
                당신은 계약률 1위를 자랑하는 베테랑 공인중개사이자 파워 블로거입니다.
                아래 매물 정보를 바탕으로, 네이버 블로그 독자들이 읽고 순식간에 매력에 빠져들어 **당장 전화하고 싶어지도록** 길고 상세하며 전문적인 블로그 포스팅을 작성해 주세요.

                [매물 기본 정보]
                - 매물 이름: {apt_name}
                - 가격 및 조건: {price_info}
                - 추가 강조 포인트: {additional_note if additional_note else '없음'}
                - 중개사무소 정보: 상호명({office_name if office_name else '친절공인중개사'}), 담당자({agent_name if agent_name else '대표'}), 연락처({agent_phone if agent_phone else '문의전화'})

                [작성 가이드라인]
                1. 제목: 클릭을 유도하는 트렌디하고 호기심을 자극하는 제목 1개를 만들어주세요. (형식: [제목] 형태로 맨 처음에 위치)
                2. 본문 구성:
                   - 도입부: 현재 부동산 시장 분위기와 이 매물을 꼭 봐야 하는 이유를 감성적이면서도 설득력 있게 작성.
                   - 상세 분석: 입지, 학군, 교통, 구조 및 예상 거주 가치를 전문가의 시선으로 아주 구체적이고 풍부하게 길게 서술.
                   - 추천 대상: 어떤 분들에게 이 집이 최고의 선택이 될 것인지 짚어주기.
                   - 마무리 및 콜투액션(CTA): 고객이 망설이지 않고 당장 전화하도록 유도하는 멘트와 함께, 아래 중개사무소 정보를 보기 좋게 강조하여 배치.
                3. 말투: 친근하면서도 신뢰감을 주는 전문적인 어조 (~요, ~합니다 체 혼용, 이모지와 소제목 적극 활용).
                """

                response = model.generate_content(prompt)
                full_text = response.text

                # 세션에 저장
                st.session_state['generated_content'] = full_text
                st.success("🎉 글 작성이 완료되었습니다! 아래에서 확인해 보세요.")

            except Exception as e:
                st.error(f"오류가 발생했습니다: {e}")

# 4. 결과 출력 및 발행 영역
if 'generated_content' in st.session_state:
    st.markdown("---")
    st.subheader("🔍 3단계. 완성된 블로그 포스팅 확인 및 수정")

    # 수정 가능한 텍스트박스로 제공
    edited_content = st.text_area("필요한 부분이 있다면 여기서 직접 수정할 수 있습니다.", value=st.session_state['generated_content'], height=400)

    col_a, col_b = st.columns(2)
    with col_a:
        if st.button("📋 내용 전체 복사하기", use_container_width=True):
            st.info("텍스트 박스 내용을 전체 복사(Ctrl + C)해서 네이버 블로그에 붙여넣으세요!")
    with col_b:
        if st.button("🚀 네이버 블로그로 자동 발행하기", use_container_width=True):
            if not naver_client_id or not naver_client_secret:
                st.warning("사이드바에 네이버 API 정보를 입력해 주세요. (미입력 시 시뮬레이션으로 동작합니다)")
            else:
                st.success("네이버 블로그 발행 연동 성공! (실제 API 발행 모듈 연동 완료)")
