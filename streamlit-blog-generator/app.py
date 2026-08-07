import streamlit as st

# 페이지 설정 (스마트폰 화면에 최적화)
st.set_page_config(page_title="부동산 1분 비서", page_icon="🏠", layout="centered")

# CSS를 이용해 버튼 글씨를 크게 키우고 5060 사용자 맞춤형 UI 스타일링
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

# 타이틀
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
    if apartment_name and price_info:
        with st.spinner("AI 부동산 비서가 네이버 상위 노출 글을 작성 중입니다... 잠시만 기다려주세요!"):
            # AI가 작성한 가상의 블로그 초안 생성 시뮬레이션
            generated_title = f"[매물소개] {apartment_name} {price_info} - 강력 추천 귀한 매물!"
            generated_content = f"""
안녕하세요! 동네 최고의 정직한 부동산입니다.
오늘 소개해 드릴 매물은 교통과 학군이 모두 완벽한 '{apartment_name}'입니다.

■ 매물 요약: {price_info}
■ 특징:
- 채광과 환기가 매우 우수하며 관리상태가 최상입니다.
- 인근 편의시설 및 대중교통 이용이 매우 편리합니다.
- 직접 보시면 훨씬 더 마음에 드실 겁니다!

자세한 문의나 현장 방문을 원하시면 언제든지 편하게 연락 주십시오.
친절하게 상담해 드리겠습니다! 감사합니다.
            """

            # 세션에 저장하여 승인 화면에서 유지
            st.session_state['title'] = generated_title
            st.session_state['content'] = generated_content
            st.session_state['ready'] = True
    else:
        st.error("아파트 이름과 가격 정보를 모두 입력해 주세요!")

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
