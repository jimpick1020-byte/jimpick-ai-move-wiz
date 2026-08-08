"""매물 사진을 공개 이미지 호스팅에 업로드하는 모듈.

네이버 블로그 글쓰기 API는 본문에 이미지를 직접 첨부하는 기능이 없습니다.
그래서 사진을 외부 이미지 호스팅(imgbb)에 올려 공개 URL을 받은 뒤,
블로그 본문 HTML 안에 <img> 태그로 삽입하는 방식으로 사진을 게시글에 보이게 합니다.

imgbb 무료 API 키는 https://api.imgbb.com/ 에서 발급받을 수 있습니다.

주의: 여기에 업로드된 사진은 외부 서비스(imgbb)에 공개적으로 저장됩니다.
"""

import base64

import requests

IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload"


def upload_to_imgbb(api_key, image_bytes, name=None):
    """이미지 바이트를 imgbb에 올리고 직접 접근 가능한 URL을 반환합니다."""
    b64 = base64.b64encode(image_bytes).decode("ascii")
    resp = requests.post(
        IMGBB_UPLOAD_URL,
        data={"key": api_key, "image": b64, "name": name or "photo"},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        err = data.get("error", {})
        raise RuntimeError(err.get("message", "이미지 업로드에 실패했습니다."))
    # display_url 은 최적화된 직접 링크, url 은 원본 링크
    info = data.get("data", {})
    return info.get("display_url") or info.get("url")


def upload_many(api_key, files, progress=None):
    """업로드된 여러 사진을 순서대로 올려 URL 목록을 돌려줍니다.

    progress: (현재개수, 전체개수, 파일이름)을 받는 콜백 (선택).
    실패한 사진은 건너뛰고 계속 진행합니다.
    """
    urls = []
    total = len(files or [])
    for idx, f in enumerate(files or [], start=1):
        if progress:
            progress(idx, total, getattr(f, "name", "photo"))
        try:
            url = upload_to_imgbb(api_key, f.getvalue(), name=getattr(f, "name", None))
            if url:
                urls.append(url)
        except Exception:
            # 특정 사진 업로드 실패는 무시하고 나머지 진행
            continue
    return urls
