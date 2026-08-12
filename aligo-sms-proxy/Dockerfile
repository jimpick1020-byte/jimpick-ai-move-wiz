# JIMPICK 문자발송 중계 서버 (Google Cloud Run 용)
FROM node:20-slim

WORKDIR /app

# 먼저 의존성만 설치해 이미지 빌드를 빠르게 합니다
COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Cloud Run 이 PORT 를 넣어 줍니다
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
