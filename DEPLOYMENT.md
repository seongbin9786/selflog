# My Time - AWS 배포 가이드

현재 배포 기본 전략은 다음과 같습니다.

- API: API Gateway 기본 도메인(`https://{api-id}.execute-api.ap-northeast-2.amazonaws.com`)
- Web: CloudFront 기본 도메인(`https://{distribution}.cloudfront.net`)
- DNS/Route53/커스텀 도메인: 기본 배포에는 필수 아님

---

## 1. 사전 준비

### 1-1. IAM 사용자

배포 전용 IAM 사용자(예: `serverless-deployment`)를 사용합니다.

필수 권한 예시:

- `AmazonS3FullAccess`
- `CloudFrontFullAccess`
- `AmazonAPIGatewayAdministrator`
- `AWSLambda_FullAccess`
- `AWSCloudFormationFullAccess`
- `AmazonDynamoDBFullAccess`
- `AmazonSSMFullAccess`
- `IAMFullAccess`

### 1-2. AWS CLI 설정

```bash
aws configure
```

### 1-3. 필수 환경 변수

- `JWT_SECRET`: API 인증 토큰 서명 키
- `WEB_ORIGIN`: API CORS 허용 Origin (예: CloudFront URL)
- `VITE_API_URL`: Web에서 호출할 API URL

---

## 2. 수동 1차 배포 (권장 순서)

### 2-1. 의존성 설치

```bash
pnpm install
```

### 2-2. API 배포

```bash
export JWT_SECRET="your-secure-random-key"
# Web 배포 URL이 아직 없으면 임시로 기존 CloudFront URL 또는 추후 갱신 예정 값 사용
export WEB_ORIGIN="https://d26x4qtxlzxa3w.cloudfront.net"

pnpm deploy:api:prod
```

API URL 확인:

```bash
aws cloudformation describe-stacks \
  --stack-name my-time-api-prod \
  --region ap-northeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
  --output text
```

### 2-3. Web 배포

```bash
export VITE_API_URL="https://{api-id}.execute-api.ap-northeast-2.amazonaws.com"
pnpm deploy:web:prod
```

Web URL 확인:

```bash
aws cloudformation describe-stacks \
  --stack-name my-time-web-prod \
  --region ap-northeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text
```

---

## 3. 자동 배포 (CD)

`main` 브랜치 push 시 `.github/workflows/deploy.yml`가 실행됩니다.

워크플로우 동작:

1. AWS 자격증명 설정
2. `my-time-web-prod`의 CloudFront URL 조회 -> `WEB_ORIGIN`으로 API 배포
3. `my-time-api-prod`의 API URL 조회 -> `VITE_API_URL`로 Web 배포
4. API/Web 스모크 테스트

### 3-1. GitHub Secrets

반드시 설정해야 하는 값:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `JWT_SECRET`

---

## 4. CORS 정책

현재 API CORS는 stage별 `WEB_ORIGIN` 단일 값 기준입니다.

- 설정 위치: `apps/api/serverless.yml`
- 런타임 검사 위치: `apps/api/src/index.ts`

운영 도메인이 바뀌면, 배포 시 `WEB_ORIGIN`을 새 도메인으로 넣고 API를 다시 배포하세요.

---

## 5. 배포 후 점검

### 5-1. API

```bash
curl -i https://{api-id}.execute-api.ap-northeast-2.amazonaws.com/
```

정상 응답 예시:

- `200 OK`
- 본문: `Hello from Hono!`

### 5-2. Web

```bash
curl -i https://{distribution}.cloudfront.net
```

정상 응답 예시:

- `200 OK`
- `content-type: text/html`

---

## 6. (선택) 커스텀 도메인

커스텀 도메인은 선택 사항입니다.

- 기본 배포는 커스텀 도메인 없이 운영 가능
- 필요 시 API Gateway/CloudFront 콘솔에서 별도 연결
- Route53 없이 외부 DNS에서 CNAME 수동 설정 가능

커스텀 도메인 운영 시에는 인증서(ACM 리전 요건)와 CORS/환경변수를 함께 갱신해야 합니다.
