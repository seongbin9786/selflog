# My Time API

Hono 기반 서버리스 API (AWS Lambda + DynamoDB)

## 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│   AWS Lambda    │────▶│    DynamoDB     │
│   (HTTP API)    │     │   (Hono App)    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 로컬 개발 환경 설정

### 사전 요구사항

- Node.js 18+
- Docker & Docker Compose
- pnpm

### 1. 환경 변수 설정

```bash
# env.example을 .env로 복사
cp env.example .env
```

### 2. 로컬 개발 서버 실행 (권장)

#### 방법 A: Docker + 로컬 서버 (간단)

```bash
# DynamoDB Local 시작 + 테이블 생성 + 개발 서버 실행
pnpm local:start
```

#### 방법 B: 단계별 실행

```bash
# 1. DynamoDB Local 시작 (Docker)
pnpm db:start

# 2. 테이블 생성
pnpm db:create-tables

# 3. 개발 서버 실행
pnpm dev:local
```

#### 방법 C: Serverless Offline (Lambda 환경 시뮬레이션)

```bash
# 빌드 후 Serverless Offline 실행
pnpm sls:offline
```

### 3. 로컬 서비스 접속

| 서비스            | URL                   |
| ----------------- | --------------------- |
| API Server        | http://localhost:3000 |
| DynamoDB Admin UI | http://localhost:8001 |
| DynamoDB Local    | http://localhost:8000 |

## 스크립트 명령어

### 개발

| 명령어             | 설명                                         |
| ------------------ | -------------------------------------------- |
| `pnpm dev`         | 로컬 개발 서버 실행                          |
| `pnpm dev:local`   | IS_OFFLINE=true로 개발 서버 실행             |
| `pnpm local:start` | Docker + 테이블 생성 + 개발 서버 한번에 실행 |
| `pnpm build`       | 프로덕션 빌드                                |

### DynamoDB Local

| 명령어                  | 설명                         |
| ----------------------- | ---------------------------- |
| `pnpm db:start`         | Docker로 DynamoDB Local 시작 |
| `pnpm db:stop`          | DynamoDB Local 중지          |
| `pnpm db:create-tables` | 로컬 테이블 생성             |
| `pnpm db:delete-tables` | 로컬 테이블 삭제             |
| `pnpm db:reset`         | 테이블 삭제 후 재생성        |

### Serverless Framework

| 명령어                 | 설명                                             |
| ---------------------- | ------------------------------------------------ |
| `pnpm sls:offline`     | Serverless Offline 실행 (Lambda 환경 시뮬레이션) |
| `pnpm sls:deploy`      | AWS dev 스테이지 배포                            |
| `pnpm sls:deploy:prod` | AWS prod 스테이지 배포                           |
| `pnpm sls:remove`      | AWS 리소스 제거                                  |

## AWS 배포

### 사전 요구사항

```bash
# AWS CLI 설정
aws configure
```

### 배포

```bash
# dev 환경 배포
pnpm sls:deploy

# prod 환경 배포
pnpm sls:deploy:prod
```

### 리소스 제거

```bash
pnpm sls:remove
```

## API 엔드포인트

### 인증

```
POST /auth/signup   - 회원가입
POST /auth/login    - 로그인
```

### 로그 (인증 필요)

```
POST /raw-logs          - 로그 저장
GET  /raw-logs/:date    - 날짜별 로그 조회
```

## 환경 변수

| 변수                   | 설명                    | 기본값                |
| ---------------------- | ----------------------- | --------------------- |
| `AWS_REGION`           | AWS 리전                | ap-northeast-2        |
| `IS_OFFLINE`           | 로컬 DynamoDB 사용 여부 | false                 |
| `JWT_SECRET`           | JWT 서명 키             | -                     |
| `DYNAMODB_TABLE_USERS` | 사용자 테이블명         | my-time-users-{stage} |
| `DYNAMODB_TABLE`       | 로그 테이블명           | my-time-logs-{stage}  |
| `PORT`                 | 서버 포트               | 3000                  |

## 테스트 환경 비교

| 기능                   | Docker + dev | Serverless Offline |
| ---------------------- | ------------ | ------------------ |
| Lambda 환경 시뮬레이션 | ❌           | ✅                 |
| API Gateway 시뮬레이션 | ❌           | ✅                 |
| 핫 리로드              | ✅           | ⚠️                 |
| DynamoDB               | ✅           | ✅                 |
| IAM 시뮬레이션         | ❌           | ❌                 |
| 설정 복잡도            | 낮음         | 중간               |
| 속도                   | 빠름         | 중간               |
| 권장 용도              | 일반 개발    | 배포 전 테스트     |
