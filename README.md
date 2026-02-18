# My Time ⏰

시간 관리 및 기록 애플리케이션

## 🏗️ 프로젝트 구조

```
my-time/
├── apps/
│   ├── web/          # React + Vite 프론트엔드
│   └── api/          # Hono + Lambda 백엔드
├── packages/
│   └── eslint-config/
└── scripts/          # 배포 및 유틸리티 스크립트
```

## 🚀 빠른 시작 (Getting Started)

### 1) 로컬 실행

```bash
pnpm install
pnpm dev
```

### 2) 빌드

```bash
pnpm build
```

### 3) 프로덕션 자동 배포 (GitHub Actions)

1. GitHub Secrets 설정: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `JWT_SECRET`
2. `us-east-1` ACM 인증서 발급 + DNS CNAME 검증 후 `WEB_DOMAIN_NAME`, `ACM_CERTIFICATE_ARN` 설정
3. `main` 브랜치에 push 하면 자동 배포

### 4) 프로덕션 수동 배포

```bash
# 1) 루트 배포 env 파일 생성/수정
cp .env.production.example .env.production
# dev면
# cp .env.development.example .env.development

# 2) 배포
pnpm run deploy:prod
# pnpm run deploy:dev
```

`deploy`는 루트 `.env` 파일을 자동 로드하고,
`WEB_ORIGIN`/`VITE_API_URL`를 자동 계산해 배포합니다.

## 📦 배포

Full AWS 스택으로 배포됩니다 (S3 + CloudFront + Lambda + DynamoDB)

상세한 배포 가이드는 **[DEPLOYMENT.md](./DEPLOYMENT.md)** 참고

기본 운영 도메인:

- Web: 커스텀 도메인
- API: API Gateway `execute-api` 도메인

### CD (GitHub Actions)

`main` push 시 `.github/workflows/deploy.yml`로 프로덕션 자동 배포가 실행됩니다.

필수 GitHub Secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `JWT_SECRET`
- `WEB_DOMAIN_NAME`
- `ACM_CERTIFICATE_ARN`

## 🛠️ 기술 스택

### 프론트엔드

- React 18
- TypeScript
- Vite
- Redux Toolkit
- TailwindCSS + DaisyUI
- React Router

### 백엔드

- Hono (Web Framework)
- AWS Lambda
- DynamoDB
- JWT 인증
- Serverless Framework

### 인프라

- AWS S3 (정적 호스팅)
- AWS CloudFront (CDN)
- AWS Lambda (서버리스 컴퓨팅)
- AWS DynamoDB (NoSQL 데이터베이스)
- AWS API Gateway (API 관리)

## 📝 주요 명령어

```bash
# 개발
pnpm dev              # 전체 개발 서버
pnpm dev:web          # 프론트엔드 개발 서버
pnpm dev:api          # 백엔드 개발 서버

# 빌드
pnpm build            # 전체 빌드
pnpm build:web        # 프론트엔드 빌드
pnpm build:api        # 백엔드 빌드

# 테스트
pnpm test             # 전체 테스트
pnpm test:web         # 프론트엔드 테스트

# 린트
pnpm lint             # 전체 린트
pnpm lint:fix         # 린트 자동 수정

# 배포
pnpm run deploy:prod     # 전체 배포 (prod)
pnpm run deploy:dev      # 전체 배포 (dev)
```

## 🔐 환경 변수

### 배포용 (루트 `.env.production`)

```bash
JWT_SECRET=your-fixed-secret
WEB_DOMAIN_NAME=my-commit.com
ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/xxxx
```

`dev` 배포 시에는 `.env.development`가 동일한 방식으로 사용됩니다.

### 프론트엔드 로컬 개발 (apps/web/.env.local)

```bash
VITE_API_URL=http://localhost:3000
```

프로덕션 배포에서는 `VITE_API_URL`을 수동 입력하지 않습니다.
배포 시 API Gateway endpoint를 자동 조회해 주입합니다.
자세한 내용은 `DEPLOYMENT.md` 참고

## 💰 AWS 프리티어

모든 서비스가 AWS 프리티어로 운영 가능합니다:

- S3: 5GB 저장 + 20,000 GET 요청
- CloudFront: 1TB 전송 + 10M 요청
- Lambda: 100만 요청
- DynamoDB: 25GB 저장
- API Gateway: 100만 요청

## 📄 라이선스

MIT

## 🤝 기여

이슈와 PR은 언제나 환영합니다!
