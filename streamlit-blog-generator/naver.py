"""네이버 로그인(OAuth2) 및 블로그 글쓰기 API 연동 모듈.

네이버 블로그 발행은 아래 두 단계가 필요합니다.
1) 네이버 아이디로 로그인(OAuth2)으로 사용자 access_token 을 발급받는다.
2) 그 토큰으로 블로그 글쓰기 API(openapi.naver.com/blog/writePost.json)를 호출한다.

앱 등록과 권한 설정은 네이버 개발자센터(https://developers.naver.com)에서 진행합니다.
"""

import re
import urllib.parse

import requests

# 네이버 OAuth2 / 블로그 API 엔드포인트
NAVER_AUTHORIZE_URL = "https://nid.naver.com/oauth2.0/authorize"
NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token"
NAVER_BLOG_WRITE_URL = "https://openapi.naver.com/blog/writePost.json"


def get_authorize_url(client_id, redirect_uri, state):
    """사용자를 보낼 네이버 로그인 동의 URL을 만듭니다."""
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
    }
    return NAVER_AUTHORIZE_URL + "?" + urllib.parse.urlencode(params)


def exchange_code_for_token(client_id, client_secret, code, state):
    """로그인 후 돌려받은 code 를 access_token 으로 교환합니다."""
    params = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "state": state,
    }
    resp = requests.get(NAVER_TOKEN_URL, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if "access_token" not in data:
        # 네이버는 오류를 200 응답의 본문으로 주는 경우가 있어 여기서 확인
        msg = data.get("error_description") or data.get("error") or "토큰 발급에 실패했습니다."
        raise RuntimeError(msg)
    return data["access_token"]


def _text_to_html(text):
    """평문 줄바꿈을 블로그 본문용 HTML(<br>)로 변환합니다."""
    escaped = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    return escaped.replace("\n", "<br>\n")


def _split_paragraphs(text):
    """본문을 문단 목록으로 나눕니다.

    빈 줄(블록) 기준으로 먼저 나누고, 문단이 하나뿐이면 줄 단위로 나눠
    사진을 끼워 넣을 위치를 더 확보합니다.
    """
    blocks = re.split(r"\n\s*\n", text.strip())
    paras = [b.strip() for b in blocks if b.strip()]
    if len(paras) <= 1:
        lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
        if len(lines) > 1:
            return lines
    return paras or [text.strip()]


def _paragraph_html(paragraph):
    return "<p>" + _text_to_html(paragraph) + "</p>"


def _image_html(url):
    return f'<p><img src="{url}" alt="매물 사진" style="max-width:100%;" /></p>'


def build_contents_html(text, image_urls=None):
    """본문 텍스트와 사진 URL 목록을 네이버 블로그용 HTML로 합칩니다.

    사진은 본문 맨 아래에 몰아 넣지 않고, 문단 사이사이에 고르게 분산해
    <img> 태그로 삽입합니다.
    """
    image_urls = list(image_urls or [])
    paras = _split_paragraphs(text)
    n_para = len(paras)

    # 사진이 없거나 문단이 없으면 단순 처리
    if not image_urls:
        return "\n".join(_paragraph_html(p) for p in paras)
    if n_para == 0:
        return "\n".join(_image_html(u) for u in image_urls)

    # 각 사진을 어떤 문단 "뒤"에 넣을지 고르게 분배
    n_img = len(image_urls)
    after = {}
    for i in range(n_img):
        idx = int(round((i + 1) * n_para / (n_img + 1))) - 1
        idx = max(0, min(n_para - 1, idx))
        after.setdefault(idx, []).append(image_urls[i])

    parts = []
    for p_idx, para in enumerate(paras):
        parts.append(_paragraph_html(para))
        for url in after.get(p_idx, []):
            parts.append(_image_html(url))
    return "\n".join(parts)


def publish_post(access_token, title, contents_html):
    """네이버 블로그 글쓰기 API로 실제 글을 발행합니다.

    contents_html 은 build_contents_html()로 만든 완성된 HTML을 그대로 전달합니다.
    성공 시 가능한 경우 글 URL을 추출해 반환하고, 없으면 원본 응답을 반환합니다.
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    data = {
        "title": title,
        "contents": contents_html,
    }
    resp = requests.post(NAVER_BLOG_WRITE_URL, headers=headers, data=data, timeout=20)

    # 실패 시 서버가 준 메시지를 최대한 담아 예외를 던집니다.
    try:
        payload = resp.json()
    except ValueError:
        payload = None

    if resp.status_code != 200:
        detail = ""
        if isinstance(payload, dict):
            msg = payload.get("message")
            if isinstance(msg, dict):
                detail = msg.get("error") or msg.get("@message") or ""
        raise RuntimeError(f"발행 실패 (HTTP {resp.status_code}) {detail}".strip())

    # 응답에서 글 URL을 최대한 찾아봅니다. (스키마가 버전에 따라 다를 수 있어 방어적으로 처리)
    post_url = _extract_post_url(payload)
    return {"url": post_url, "raw": payload}


def _extract_post_url(payload):
    """응답 JSON에서 게시글 URL로 보이는 값을 최대한 찾아냅니다."""
    if not isinstance(payload, (dict, list)):
        return None

    found = []

    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if isinstance(v, str) and k.lower() in ("url", "logno_url", "posturl") and v.startswith("http"):
                    found.append(v)
                else:
                    walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    return found[0] if found else None
