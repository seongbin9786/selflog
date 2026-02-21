# My Commit 배포 가이드

## 1) 수동 배포 시나리오

1. AWS CLI 인증 설정

```bash
aws configure
# 필요 시 멀티 프로필 구성 후 원하는 프로필 사용:
# export AWS_PROFILE=my-aws-profile
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

### 1-1) 최초 배포 (새 도메인/새 환경)

1. `.env.production`에 `WEB_DOMAIN_NAME` 먼저 설정

2. ACM 생성 + DNS 검증 자동화(권장, Porkbun):

```bash
pnpm run create:aws:acm:prod:porkbun
# ACM DNS 검증/발급 대기 시간은 보통 약 1분 30초 내외(환경에 따라 더 길 수 있음)
```

3. 출력된 박스의 `Copy line` 값을 `.env.production`의 `ACM_CERTIFICATE_ARN=`에 그대로 반영

4. 첫 배포 실행

```bash
pnpm install
pnpm run deploy:prod:porkbun
```

### 1-2) 후속 배포 (코드 변경 배포)

기본적으로 DNS가 이미 맞다면 아래만 실행:

```bash
pnpm run deploy:prod
```

DNS 변경(도메인 이전/레코드 재동기화)이 필요한 경우만:

```bash
pnpm run deploy:prod:porkbun
# DNS만 별도 반영할 때 (CloudFront 주소는 스택 Output에서 자동 조회)
pnpm run dns:sync:porkbun -- prod
```

dev는 동일하게 `:dev` 명령으로 대응:

```bash
pnpm run create:aws:acm:dev:porkbun
pnpm run deploy:dev
# 필요 시 pnpm run deploy:dev:porkbun
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
| `AWS_PROFILE`         | 아니오 | 미지정 시 AWS CLI 기본 profile 사용 |
| `UPDATE_DNS_RECORD`   | 아니오 | `false`(기본). `true`일 때만 DNS 동기화 수행 |
| `DNS_PROVIDER`        | 아니오 | `none`(기본) 또는 `porkbun`         |

### 2-2. 자동 계산 변수 (입력 금지)

| 변수           | 계산 방식                                             | 용도              |
| -------------- | ----------------------------------------------------- | ----------------- |
| `WEB_ORIGIN`   | `https://WEB_DOMAIN_NAME`                             | API CORS          |
| `VITE_API_URL` | `<stage>-my-commit-api` 스택의 `HttpApiUrl` Output 조회 | Web 빌드 환경변수 |

### 2-3. Porkbun DNS 자동 동기화 변수 (`UPDATE_DNS_RECORD=true` + `DNS_PROVIDER=porkbun`)

| 변수                       | 필수   | 설명                                                                 |
| -------------------------- | ------ | -------------------------------------------------------------------- |
| `PORKBUN_API_KEY`          | 예     | Porkbun API Key                                                      |
| `PORKBUN_SECRET_API_KEY`   | 예     | Porkbun Secret API Key                                               |
| `PORKBUN_ROOT_DOMAIN`      | 아니오 | 루트 도메인(미지정 시 `WEB_DOMAIN_NAME`에서 단순 추론, 권장: 명시) |
| `PORKBUN_RECORD_TYPE`      | 아니오 | 기본: apex=`ALIAS`, subdomain=`CNAME`                               |
| `PORKBUN_TTL`              | 아니오 | 기본: `600`                                                          |
| `PORKBUN_DRY_RUN`          | 아니오 | `true`면 API 호출 없이 변경 계획만 출력                              |

필수 사전 설정:
- Porkbun 도메인 관리 화면에서 대상 도메인(`my-commit.com`)의 `API Access`를 먼저 활성화(Opt-in)해야 합니다.

## 3) 커스텀 도메인 (필수)

1. `us-east-1` ACM에서 `my-commit.com` 인증서 발급 + DNS CNAME 검증 완료
2. `.env.production`(prod) 또는 `.env.development`(dev)에 `WEB_DOMAIN_NAME`, `ACM_CERTIFICATE_ARN` 추가
3. `pnpm run deploy:prod` 또는 `pnpm run deploy:dev` 실행
   - Porkbun DNS 자동 동기화까지 원하면 `pnpm run deploy:prod:porkbun` 사용
4. DNS 구매처에서 루트 도메인을 CloudFront 도메인으로 ALIAS/ANAME(flattening) 연결

참고:

- 이 프로젝트는 CloudFront `Add domain`을 IaC로 처리하므로 콘솔 수동 입력이 필수가 아닙니다.
- `deploy:*:porkbun` 스크립트는 `UPDATE_DNS_RECORD=true`를 자동으로 설정해 DNS까지 반영합니다.
- Porkbun API를 쓰는 경우, 도메인별 `API Access`가 꺼져 있으면 `Domain is not opted in to API access` 오류가 발생합니다.
- API Gateway 커스텀 도메인은 현재 기본 배포 범위 밖입니다.

## 4) 배포 실패 시 가능한 원인

- `JWT_SECRET`, `WEB_DOMAIN_NAME`, `ACM_CERTIFICATE_ARN` 누락
- ACM 인증서 조건 불일치 (`us-east-1` 아님, DNS 검증 미완료, 도메인 불일치)
- 동일 도메인을 다른 CloudFront 배포에서 이미 사용 중 (`CNAMEAlreadyExists`)

## 4-1) ACM 자동 생성 (선택)

```bash
# prod 기준: ACM 생성 + Porkbun DNS 검증 레코드 자동 반영 + 발급 대기
pnpm run create:aws:acm:prod:porkbun
# ACM DNS 검증/발급 대기 시간은 보통 약 1분 30초 내외(환경에 따라 더 길 수 있음)

# 수동 DNS를 원하면
pnpm run create:aws:acm -- prod --domain my-commit.com
```

## 4-2) 전체 제거/초기화 (선택)

```bash
# prod 스택 + ACM 제거 (기본)
pnpm run undeploy:prod

# dev 스택 + ACM 제거 (기본)
pnpm run undeploy:dev

# ACM 유지가 필요하면
pnpm run undeploy -- prod --keep-acm
```

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
  --stack-name prod-my-commit-api \
  --region ap-northeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
  --output text

# profile 지정 시 (env 방식)
AWS_PROFILE=my-aws-profile aws cloudformation describe-stacks \
  --stack-name prod-my-commit-api \
  --region ap-northeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
  --output text
```

Web URL:

```bash
aws cloudformation describe-stacks \
  --stack-name prod-my-commit-web \
  --region ap-northeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text

# profile 지정 시 (env 방식)
AWS_PROFILE=my-aws-profile aws cloudformation describe-stacks \
  --stack-name prod-my-commit-web \
  --region ap-northeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text
```

Porkbun DNS 조회:

```bash
pnpm run dns:check:porkbun -- prod --name my-commit.com
```
