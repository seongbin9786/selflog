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

### 3) 프로덕션 배포 (가장 쉬운 방법)

1. GitHub Secrets 설정: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `JWT_SECRET`
2. (커스텀 도메인 선택 시) `WEB_DOMAIN_NAME`, `ACM_CERTIFICATE_ARN` 추가
3. `main` 브랜치에 push 하면 자동 배포

### 4) 수동 배포 (선택)

```bash
# 방법 A: aws configure로 자격증명 설정
# 방법 B: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION 환경변수 설정
export JWT_SECRET="your-fixed-secret"
pnpm deploy:all:prod
```

## 📦 배포

Full AWS 스택으로 배포됩니다 (S3 + CloudFront + Lambda + DynamoDB)

상세한 배포 가이드는 **[DEPLOYMENT.md](./DEPLOYMENT.md)** 참고

기본 운영 도메인:

- Web: CloudFront 도메인
- API: API Gateway `execute-api` 도메인
- 커스텀 도메인: 선택 사항

### CD (GitHub Actions)

`main` push 시 `.github/workflows/deploy.yml`로 프로덕션 자동 배포가 실행됩니다.

필수 GitHub Secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `JWT_SECRET`

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
pnpm deploy:all       # 전체 배포 (dev)
pnpm deploy:all:prod  # 전체 배포 (prod)
pnpm deploy:web       # 프론트엔드만 배포
pnpm deploy:api       # 백엔드만 배포
```

## 🔐 환경 변수

### 백엔드 (apps/api/.env)

```bash
JWT_SECRET=your-secret-key-here
```

### 프론트엔드 (apps/web/.env.production)

```bash
VITE_API_URL=https://your-api-gateway-url
```

`pnpm build`(production 모드) 기준 파일이므로 `apps/web/.env.production`을 사용합니다.
CI처럼 환경변수로 직접 주입하면 파일 없이도 배포 가능합니다.
자세한 내용은 각 디렉토리의 `.env.example` 참고

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
