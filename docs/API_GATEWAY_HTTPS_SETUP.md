# API Gateway HTTPS / Custom Domain (선택)

이 문서는 **기본 배포(= execute-api 기본 도메인 사용)** 이후, 필요할 때만 커스텀 API 도메인을 붙이는 절차를 설명합니다.

기본 운영에는 필수 아님:

- 기본 API URL: `https://{api-id}.execute-api.ap-northeast-2.amazonaws.com`

---

## 1. 사전 준비

### 1-1. ACM 인증서

API Gateway용 인증서는 API 리전(`ap-northeast-2`)에 있어야 합니다.

1. AWS Console > Certificate Manager
2. 리전: `ap-northeast-2`
3. `api.yourdomain.com` 또는 `*.yourdomain.com` 인증서 발급
4. DNS 검증 완료(`Issued`)

### 1-2. 배포 전제

- API 스택(`my-time-api-prod`)이 먼저 배포되어 있어야 함
- 외부 DNS(가비아/Cloudflare 등) 접근 권한 필요

---

## 2. API Gateway 콘솔에서 커스텀 도메인 연결

1. AWS Console > API Gateway > Custom domain names
2. `Create`
3. 설정:
   - Domain name: `api.yourdomain.com`
   - Endpoint: `Regional`
   - TLS: `TLS 1.2`
   - Certificate: 위 인증서 선택
4. 저장 후 대상 API(`my-time-api-prod`)와 매핑

---

## 3. 외부 DNS 설정

외부 DNS에 CNAME 추가:

- Host: `api`
- Value: API Gateway가 제공한 regional domain (`d-xxxxx.execute-api.ap-northeast-2.amazonaws.com`)

전파 확인:

```bash
dig api.yourdomain.com
```

---

## 4. 애플리케이션 반영

커스텀 API 도메인을 쓰려면 아래도 함께 갱신해야 합니다.

1. Web API URL

```bash
VITE_API_URL=https://api.yourdomain.com
```

2. API CORS 허용 도메인

```bash
WEB_ORIGIN=https://{your-web-domain}
```

API 재배포:

```bash
pnpm deploy:api -- --stage prod
```

Web 재배포:

```bash
pnpm deploy:web -- --stage prod
```

---

## 5. 참고

- 현재 프로젝트 기본 전략은 커스텀 도메인 없이도 운영 가능
- `serverless-domain-manager` 플러그인 기반 자동 도메인 생성은 사용하지 않음
