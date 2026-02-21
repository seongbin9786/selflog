# API 프레임워크 선택: Hono

## 핵심 결정 요인: 서비스 비용 최소화

개인 프로젝트 `my-commit`은 트래픽이 적은 서비스입니다.
따라서 운영 비용을 최소화하는 것이 중요합니다.

이를 위해 AWS Lambda + DynamoDB 조합을 선택했고,
이 인프라에 최적화된 프레임워크로 Hono를 선택했습니다.

---

## 인프라 선택: AWS Lambda + DynamoDB

### 왜 서버리스(Lambda)인가?

| 방식         | 월 비용 | 특징                                    |
| :----------- | :------ | :-------------------------------------- |
| AWS Lambda   | $0 ~ $1 | 요청 없으면 과금 없음. 월 100만 건 무료 |
| EC2 t4g.nano | $3~4    | 대기 시간에도 비용 발생                 |

트래픽이 적은 서비스는 대부분의 시간 동안 서버가 유휴 상태입니다.
EC2는 대기 시간에도 비용이 발생하지만, Lambda는 요청이 있을 때만 과금됩니다.

### 왜 DynamoDB인가?

| DB                     | Cold Start 시 연결 오버헤드 | 이유                      |
| :--------------------- | :-------------------------- | :------------------------ |
| RDS (MySQL/PostgreSQL) | 200 ~ 500ms+                | TCP 연결 + 인증 + SSL     |
| DynamoDB               | 50 ~ 100ms                  | HTTP API (연결 개념 없음) |

DynamoDB는 서버리스에 적합한 DB입니다.

- 전통적인 소켓 연결이 아닌 HTTP 요청 방식
- Lambda에서 커넥션 풀 관리 필요 없음
- AWS 내부 네트워크로 레이턴시가 낮음

---

## 프레임워크 선택: Hono vs NestJS

Lambda 환경에서는 Cold Start(콜드 스타트)가 핵심 성능 지표입니다.
서버가 꺼져 있다가 첫 요청이 들어올 때의 부팅 시간을 의미합니다.

### 부팅 시간 벤치마크 결과 (프로덕션 빌드 기준)

| 프레임워크 | 평균 부팅 시간 | 측정 방식       |
| :--------- | :------------- | :-------------- |
| Hono       | ~119ms         | 100회 반복 측정 |
| NestJS     | ~279ms         | 20회 반복 측정  |

Hono가 NestJS보다 약 2.3배 빠릅니다.

### NestJS가 느린 이유

1. 런타임 메타데이터 분석: `reflect-metadata`를 사용해 데코레이터 정보를 앱이 켜질 때마다 읽고 분석
2. 의존성 그래프 계산: 모든 모듈/서비스의 의존관계를 런타임에 계산
3. DI 컨테이너 초기화: 인스턴스 생성 순서 결정 및 주입

이러한 편의 기능으로 인해 부팅 속도가 느려집니다.

### Hono가 빠른 이유

1. 경량 설계: 서버리스/Edge 환경을 타겟으로 설계됨
2. No DI Container: 복잡한 의존성 주입 과정이 없음
3. Web Standard API: `Request`/`Response` 표준 사용으로 변환 비용 최소화

### 참고: AWS SDK 로딩 오버헤드

프로파일링 결과, 부팅 시간의 상당 부분은 AWS SDK 로딩에 소요됩니다:

```
@aws-sdk/lib-dynamodb: ~60ms
@aws-sdk/client-dynamodb: ~58ms
jsonwebtoken: ~20ms
hono: ~12ms
```

이는 Hono/NestJS 관계없이 발생하는 공통 비용이며,
필요시 Lazy Loading으로 최적화할 수 있습니다.

---

## 최종 Cold Start 예상 시간

Lambda에서 실제 사용자가 체감하는 첫 응답 시간:

| 단계                                 | 시간   |
| ------------------------------------ | ------ |
| Lambda 컨테이너 시작                 | ~50ms  |
| Hono 앱 로딩                         | ~120ms |
| DynamoDB 첫 요청 (TLS)               | ~100ms |
| ------------------------------------ | ------ |
| 총 첫 번째 요청 응답 시간            | ~270ms |

0.27초 정도의 응답 시간은 사용자가 지연을 느끼지 않는 수준입니다.

---

## 개발 경험 (DX) 비교

| 항목        | NestJS                                        | Hono                             |
| :---------- | :-------------------------------------------- | :------------------------------- |
| 구조화      | 강제되는 아키텍처 (Module/Controller/Service) | 자유로움 (직접 정해야 함)        |
| DI          | 자동 (데코레이터 기반)                        | 수동 (Context 또는 Factory 패턴) |
| 타입 안전성 | 좋음                                          | 매우 좋음 (RPC 지원)             |
| 학습 곡선   | 높음                                          | 낮음                             |

Hono는 NestJS보다 구조가 단순하여, 간단한 CRUD API 개발에 적합합니다.

---

## 결론

> 트래픽 적은 서비스 = 서버리스 + 가벼운 프레임워크

- 인프라: AWS Lambda + DynamoDB → 비용 $0 유지
- 프레임워크: Hono → 빠른 Cold Start (~270ms)
- 개발 경험: 단순한 API에는 NestJS의 복잡한 구조보다 Hono의 간결함이 적합

이 조합이 `my-commit` 프로젝트에 적합한 선택입니다.

---

## 부록: 벤치마크 스크립트 및 상세 결과

### Hono 부팅 시간 측정 스크립트

```typescript
// scripts/profile-hono.ts
import { spawn } from "child_process";

const ITERATIONS = 100;
const PORT = 3005;
const URL = `http://localhost:${PORT}`;

async function waitForServer(url: string, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (e) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`Server did not start in ${timeout}ms`);
}

async function measureBoot() {
  const start = Date.now();
  const child = spawn("node", ["apps/api-hono/dist/index.js"], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
    stdio: "ignore",
  });

  try {
    await waitForServer(URL);
    const duration = Date.now() - start;
    return { duration, child };
  } catch (e) {
    if (child.pid) process.kill(-child.pid);
    throw e;
  }
}

async function run() {
  console.log(`Profiling Hono Prod Boot Time (${ITERATIONS} iterations)...`);

  const durations: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    process.stdout.write(`\rIteration ${i + 1}/${ITERATIONS}`);
    try {
      const { duration, child } = await measureBoot();
      durations.push(duration);
      child.kill();
      await new Promise((r) => setTimeout(r, 50));
    } catch (e) {
      console.error(`\nFailed at iteration ${i}:`, e);
    }
  }
  console.log("\nDone.");

  if (durations.length === 0) return;

  durations.sort((a, b) => a - b);
  const sum = durations.reduce((a, b) => a + b, 0);
  const avg = sum / durations.length;
  const min = durations[0];
  const max = durations[durations.length - 1];
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];

  console.log(`\nHono Boot Time Statistics:`);
  console.log(`  Avg: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${min.toFixed(2)}ms`);
  console.log(`  Max: ${max.toFixed(2)}ms`);
  console.log(`  P50: ${p50.toFixed(2)}ms`);
  console.log(`  P95: ${p95.toFixed(2)}ms`);
  console.log(`  P99: ${p99.toFixed(2)}ms`);
}

run();
```

### 모듈 로딩 시간 프로파일링 스크립트

```javascript
// scripts/trace-require.js
const Module = require("module");

const originalRequire = Module.prototype.require;
const stats = [];

Module.prototype.require = function (path) {
  const start = process.hrtime();
  const result = originalRequire.apply(this, arguments);
  const diff = process.hrtime(start);
  const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;

  if (
    !path.startsWith("./") &&
    !path.startsWith("../") &&
    !path.startsWith("/")
  ) {
    stats.push({ path, duration: durationMs });
  }
  return result;
};

require("../apps/api-hono/dist/index.js");

setTimeout(() => {
  stats.sort((a, b) => b.duration - a.duration);
  console.log("\n===== Top 20 Slowest Requires =====");
  stats.slice(0, 20).forEach((s, i) => {
    console.log(`${i + 1}. ${s.path}: ${s.duration.toFixed(3)}ms`);
  });
  process.exit(0);
}, 2000);
```

### Hono 측정 결과 (100회 반복)

```
Profiling Hono Prod Boot Time (100 iterations)...
Iteration 100/100
Done.

Hono Boot Time Statistics:
  Avg: 114.66ms
  Min: 99.00ms
  Max: 215.00ms
  P50: 112.00ms
  P95: 152.00ms
  P99: 215.00ms
```

### NestJS 측정 결과 (20회 반복)

```
Profiling NestJS Prod Boot Time (20 iterations)...
Iteration 20/20
Done.

NestJS Boot Time Statistics:
  Avg: 279.40ms
  Min: 260.00ms
  Max: 495.00ms
  P50: 265.00ms
```

### 모듈 로딩 프로파일링 결과 (Hono)

Top 20 Slowest Requires

1. @aws-sdk/lib-dynamodb: 59.779ms
2. @aws-sdk/client-dynamodb: 58.326ms
3. @aws-sdk/middleware-user-agent: 30.646ms
4. jsonwebtoken: 20.312ms
5. @smithy/core: 19.132ms
6. @smithy/core/protocols: 17.695ms
7. @smithy/util-stream: 13.184ms
8. hono: 11.530ms
9. @aws-sdk/core: 9.062ms
10. semver: 7.921ms
11. @smithy/node-http-handler: 5.849ms
12. jws: 5.594ms
13. @smithy/middleware-endpoint: 3.645ms
14. hono/jwt: 3.260ms
15. http2: 3.132ms
16. @aws-sdk/middleware-endpoint-discovery: 2.804ms
17. @smithy/core/serde: 2.628ms
18. jwa: 2.520ms
19. hono/aws-lambda: 2.258ms
20. @smithy/middleware-retry: 2.116ms

### 스크립트 실행 방법

```bash
# Hono 빌드
pnpm --filter my-commit-api-hono build

# Hono 부팅 시간 측정 (100회)
pnpm exec tsx scripts/profile-hono.ts

# 모듈 로딩 시간 프로파일링
node scripts/trace-require.js
```

---

- 측정 환경: macOS, Node.js v22.15.1, Apple Silicon
- 측정일: 2026-01-09
