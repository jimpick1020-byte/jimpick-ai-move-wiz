# JIMPICK 문자발송 중계 서버 (aligo-sms-proxy)

알리고는 **등록된 IP 에서 온 요청만** 받아 줍니다.
그런데 Supabase Edge Function 은 나가는 IP 가 그때그때 달라져서 등록을 할 수 없습니다.

그래서 **IP 를 고정할 수 있는 이 서버**를 가운데 둡니다.

```
짐픽 앱
  → Supabase Edge Function (send-estimate-sms)
  → 이 서버 (Google Cloud Run, 고정 IP)
  → 알리고 문자 API
  → 고객 휴대전화
```

---

## 1. 필요한 환경변수

| 이름 | 어디서 얻나요 |
|---|---|
| `ALIGO_API_KEY` | 알리고 > 문자 API > API Key |
| `ALIGO_USER_ID` | 알리고 로그인 아이디 |
| `JIMPICK_PROXY_SECRET` | 직접 만든 무작위 문자열 (40자 이상 권장) |
| `SUPABASE_URL` | 배포 환경에 이미 설정된 백엔드 주소 |
| `SUPABASE_SERVICE_ROLE_KEY` | 배포 환경의 서버 전용 비밀값 (관리형 환경에서는 직접 조회할 수 없음) |

> `SUPABASE_SERVICE_ROLE_KEY`는 **절대 앱이나 브라우저에 넣지 마세요.** 관리형 환경에서 값을 꺼내거나 임의로 만들 수 없습니다. 기존 중계 서버에 안전하게 주입되지 않은 경우 연결 작업이 먼저 필요합니다.

업체별 발신번호는 알리고에서 사전등록 승인 여부를 확인한 운영자가 `company_sms_senders`에 업체별로 등록해야 합니다. 번호가 없으면 요청을 거부하며, 업체 상호만 바꿔 승인되지 않은 번호를 사용할 수 없습니다.

비밀키 만드는 법 (아무 터미널에서):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 2. Google Cloud 에 올리기

미리 준비: Google Cloud 계정, 결제 등록, `gcloud` 설치

```bash
# 0) 로그인과 프로젝트 지정
gcloud auth login
gcloud config set project <프로젝트ID>
gcloud services enable run.googleapis.com compute.googleapis.com vpcaccess.googleapis.com

# 1) 이 폴더에서 배포 (서울 리전)
cd aligo-sms-proxy
gcloud run deploy aligo-sms-proxy \
  --source . \
  --region asia-northeast3 \
  --no-allow-unauthenticated \
  --set-env-vars "ALIGO_API_KEY=...,ALIGO_USER_ID=...,JIMPICK_PROXY_SECRET=...,SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=..."
```

> 키를 명령줄에 그대로 적기 싫으면 Cloud Run 콘솔의
> **변수 및 보안 비밀** 화면에서 하나씩 넣어도 됩니다. 그 편이 안전합니다.

---

## 3. 고정 IP 만들기 (가장 중요)

Cloud Run 은 기본적으로 나가는 IP 가 계속 바뀝니다.
**VPC 커넥터 + Cloud NAT** 를 붙여야 IP 가 하나로 고정됩니다.

```bash
REGION=asia-northeast3

# 1) 고정 IP 주소 하나 확보
gcloud compute addresses create jimpick-sms-ip --region=$REGION

# 2) 확보한 IP 확인 — 이 값을 알리고에 등록합니다
gcloud compute addresses describe jimpick-sms-ip --region=$REGION --format="value(address)"

# 3) 서버리스 VPC 커넥터 (Cloud Run 이 VPC 로 나가게 함)
gcloud compute networks vpc-access connectors create jimpick-connector \
  --region=$REGION --network=default --range=10.8.0.0/28

# 4) 라우터와 NAT — 나가는 트래픽을 위 고정 IP 로 묶습니다
gcloud compute routers create jimpick-router --network=default --region=$REGION

gcloud compute routers nats create jimpick-nat \
  --router=jimpick-router --region=$REGION \
  --nat-external-ip-pool=jimpick-sms-ip \
  --nat-all-subnet-ip-ranges

# 5) Cloud Run 이 이 커넥터로만 나가도록 연결
gcloud run services update aligo-sms-proxy \
  --region=$REGION \
  --vpc-connector=jimpick-connector \
  --vpc-egress=all-traffic
```

---

## 4. 알리고에 등록할 IP 확인

두 가지 방법 중 아무거나:

**① 명령으로 확인**

```bash
gcloud compute addresses describe jimpick-sms-ip \
  --region=asia-northeast3 --format="value(address)"
```

**② 서버에 물어보기** — 실제로 나가는 IP 를 그대로 알려 줍니다

```
GET https://<Cloud Run 주소>/my-ip
```

응답 예:

```json
{ "ok": true, "ip": "34.64.xxx.xxx", "hint": "이 IP 를 알리고 > 문자 API > 접속 IP 에 등록하세요." }
```

이 값을 **알리고 > 문자 API > 접속 IP 등록**에 넣습니다.

---

## 5. 앱 쪽 설정

배포 환경에 두 값을 안전하게 설정합니다.

| 이름 | 값 |
|---|---|
| `SMS_PROXY_URL` | Cloud Run 주소 (예: `https://aligo-sms-proxy-xxxx.a.run.app`) |
| `JIMPICK_PROXY_SECRET` | 이 서버에 넣은 것과 **똑같은** 값 |

문자 발송 함수와 중계 서버의 비밀값은 일치해야 합니다. 승인 발신번호는 업체별 기록에서 조회하며, 알리고 접수는 통신사 전달 성공과 구분합니다.

---

## 6. 시험해 보기

**미발송 설정 점검** — `testMode: true`는 실제 전달 확인이 아닙니다. 승인 발신번호가 등록된 테스트 업체와 수신번호로 세 종류를 실제 발송해야 전달 상태까지 확인할 수 있습니다.

```bash
curl -X POST "https://<Cloud Run 주소>/send" \
  -H "Content-Type: application/json" \
  -H "x-jimpick-secret: <JIMPICK_PROXY_SECRET>" \
  -d '{
        "to": "01012345678",
        "companyId": "<승인된 테스트 업체 UUID>",
        "userId": "<같은 업체 UUID>",
        "text": "[업체명] 이사 견적서 확인: https://<고객 보안 링크>",
        "cardType": "quote",
        "cardData": {"companyName":"<업체 상호>","customerName":"<고객명>","moveDate":"<이사 날짜>","amount":"<견적 금액>","companyPhone":"<업체 문의번호>"},
        "idempotencyKey": "test-1",
        "testMode": true
      }'
```

살아 있는지 확인: `GET /health`

---

## 7. 이 서버가 하는 일

- `POST /send` — 업체별 승인 발신번호를 조회한 뒤 SMS · LMS · MMS 전송
  - UTF-8 길이가 90바이트를 넘으면 보수적으로 **LMS(장문)**
  - `cardType`이 `quote`, `deposit`, `reminder`이면 실제 업체·고객 자료로 **MMS** 이미지를 만들어 첨부 (300KB 이하)
  - `imageBase64`를 넣어도 MMS로 보냅니다 (300KB 이하)
  - `idempotencyKey` 가 같으면 **다시 보내지 않습니다** (중복 방지)
  - 앱 경로는 호출자가 `estimate_deliveries`에 기록합니다. 중계 서버의 독립 발송은 `idempotencyKey`가 있는 경우 기록합니다.
  - 받는 번호는 **뒤 4자리만** 저장합니다
- `GET /my-ip` — 알리고에 등록할 IP 확인
- `GET /health` — 살아 있는지 확인

`x-jimpick-secret` 헤더가 맞지 않으면 **401** 로 거절합니다.
