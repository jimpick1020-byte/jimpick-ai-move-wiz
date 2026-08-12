# JIMPICK 문자발송 중계 서버 (aligo-sms-proxy)

알리고는 **등록된 IP 에서 온 요청만** 받아 줍니다.
그런데 Supabase Edge Function 은 나가는 IP 가 그때그때 달라져서 등록을 할 수 없습니다.

그래서 **IP 를 고정할 수 있는 이 서버**를 가운데 둡니다.

```
짐픽 앱
  → Supabase Edge Function (send-sms)
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
| `ALIGO_SENDER` | 사전등록을 마친 발신번호 |
| `JIMPICK_PROXY_SECRET` | 직접 만든 무작위 문자열 (40자 이상 권장) |
| `SUPABASE_URL` | Supabase > 프로젝트 설정 > API |
| `SUPABASE_SERVICE_ROLE_KEY` | 같은 화면의 `service_role` 키 |

> `service_role` 키는 **절대 앱이나 브라우저에 넣지 마세요.** 이 서버에서만 씁니다.

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
  --set-env-vars "ALIGO_API_KEY=...,ALIGO_USER_ID=...,ALIGO_SENDER=...,JIMPICK_PROXY_SECRET=...,SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=..."
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

## 5. Supabase 쪽 설정

**Edge Functions > Secrets** 에 두 개를 넣습니다.

| 이름 | 값 |
|---|---|
| `SMS_PROXY_URL` | Cloud Run 주소 (예: `https://aligo-sms-proxy-xxxx.a.run.app`) |
| `JIMPICK_PROXY_SECRET` | 이 서버에 넣은 것과 **똑같은** 값 |

그리고 함수를 올립니다.

```bash
supabase functions deploy send-sms
```

발송 이력 표도 만들어 줍니다.

```bash
supabase db push
```

---

## 6. 시험해 보기

**요금이 나가지 않는 시험 발송** — `testMode: true` 를 넣으면 실제로 가지 않습니다.

```bash
curl -X POST "https://<Cloud Run 주소>/send" \
  -H "Content-Type: application/json" \
  -H "x-jimpick-secret: <JIMPICK_PROXY_SECRET>" \
  -d '{
        "to": "01012345678",
        "text": "[JIMPICK] 시험 문자입니다.",
        "idempotencyKey": "test-1",
        "testMode": true
      }'
```

살아 있는지 확인: `GET /health`

---

## 7. 이 서버가 하는 일

- `POST /send` — 문자 보내기 (SMS · LMS · MMS 자동 선택)
  - 90바이트를 넘으면 자동으로 **LMS(장문)**
  - `imageBase64` 를 넣으면 **MMS** (그림 300KB 이하)
  - `idempotencyKey` 가 같으면 **다시 보내지 않습니다** (중복 방지)
  - 성공·실패를 모두 `estimate_deliveries` 에 기록
  - 받는 번호는 **뒤 4자리만** 저장합니다
- `GET /my-ip` — 알리고에 등록할 IP 확인
- `GET /health` — 살아 있는지 확인

`x-jimpick-secret` 헤더가 맞지 않으면 **401** 로 거절합니다.
