# My Time 배포 가이드

## 1) 가장 빠른 수동 배포

1. AWS CLI 인증 설정

```bash
aws configure
```

2. 루트에 `.env.production` 파일 생성

```bash
cp .env.production.example .env.production
```

예시:

```bash
JWT_SECRET=your-fixed-secret

WEB_DOMAIN_NAME=my-commit.com
ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/xxxx
```

3. 배포 실행

```bash
pnpm install
pnpm run deploy:prod
# pnpm run deploy:dev
```

주의:

- 간결한 env 관리를 위해 배포는 저장소 루트에서만 허용됩니다. (`apps/api`, `apps/web` 직접 배포 차단)

`export`가 필요 없는 이유:

- `scripts/deploy.sh`가 루트 `.env` 계열 파일을 자동 로드합니다.
- 로드 순서: `.env` -> `.env.local` -> `.env.<stage-env>` -> `.env.<stage-env>.local`
- stage 매핑: `prod -> production`, `dev -> development`
- 나중 파일 값이 앞선 파일 값을 덮어씁니다.

## 2) 배포 변수 표

### 2-1. 수동 입력 변수

| 변수                  | 필수   | 설명                                |
| --------------------- | ------ | ----------------------------------- |
| `JWT_SECRET`          | 예     | JWT 서명 키 (배포 간 동일 값 유지)  |
| `WEB_DOMAIN_NAME`     | 예     | Web 커스텀 도메인 (`my-commit.com`) |
| `ACM_CERTIFICATE_ARN` | 예     | `us-east-1` ACM 인증서 ARN          |
| `AWS_REGION`          | 아니오 | 기본값 `ap-northeast-2`             |

### 2-2. 자동 계산 변수 (입력 금지)

| 변수           | 계산 방식                                             | 용도              |
| -------------- | ----------------------------------------------------- | ----------------- |
| `WEB_ORIGIN`   | `https://WEB_DOMAIN_NAME`                             | API CORS          |
| `VITE_API_URL` | `<stage>-my-time-api` 스택의 `HttpApiUrl` Output 조회 | Web 빌드 환경변수 |

## 3) 커스텀 도메인 (필수)

1. `us-east-1` ACM에서 `my-commit.com` 인증서 발급 + DNS CNAME 검증 완료
2. `.env.production`(prod) 또는 `.env.development`(dev)에 `WEB_DOMAIN_NAME`, `ACM_CERTIFICATE_ARN` 추가
3. `pnpm run deploy:prod` 또는 `pnpm run deploy:dev` 실행
4. DNS 구매처에서 루트 도메인을 CloudFront 도메인으로 ALIAS/ANAME(flattening) 연결

참고:

- 이 프로젝트는 CloudFront `Add domain`을 IaC로 처리하므로 콘솔 수동 입력이 필수가 아닙니다.
- API Gateway 커스텀 도메인은 현재 기본 배포 범위 밖입니다.

## 4) 배포 실패 시 가능한 원인

- `JWT_SECRET`, `WEB_DOMAIN_NAME`, `ACM_CERTIFICATE_ARN` 누락
- ACM 인증서 조건 불일치 (`us-east-1` 아님, DNS 검증 미완료, 도메인 불일치)
- 동일 도메인을 다른 CloudFront 배포에서 이미 사용 중 (`CNAMEAlreadyExists`)

## 5) 자동 배포 (GitHub Actions)

`main` 브랜치 push 시 `.github/workflows/deploy.yml`가 실행됩니다.

필수 Secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `JWT_SECRET`
- `WEB_DOMAIN_NAME`
- `ACM_CERTIFICATE_ARN`

## 6) 배포 결과 확인

API URL:

```bash
aws cloudformation describe-stacks \
  --stack-name prod-my-time-api \
  --region ap-northeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
  --output text
```

Web URL:

```bash
aws cloudformation describe-stacks \
  --stack-name prod-my-time-web \
  --region ap-northeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text
```
