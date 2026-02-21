# Local Environment Tech Comparison

## 1. Repository Facts
- API deploy config: `apps/api/serverless.yml`
- Web deploy config: `apps/web/serverless.yml`
- API Lambda count: 1 (`functions.api`, `httpApi: "*"`)
- API local command A: `pnpm --filter my-commit-api dev:local` -> `tsx watch src/index.ts`
- API local command B: `pnpm --filter my-commit-api sls:offline` -> `pnpm build && serverless offline --stage local`

## 2. Tool Matrix (Objective)

| Item | serverless-offline | AWS SAM CLI | Lambda RIE |
| --- | --- | --- | --- |
| Maintainer | Serverless plugin | AWS | AWS |
| Primary config input | `serverless.yml` | `template.yaml` (`AWS::Serverless::*`) | Container/runtime entry setup |
| Local HTTP server built-in | Yes | Yes (`sam local start-api`) | No |
| API Gateway event shaping | Yes | Yes | No |
| Single function invoke | Via framework route/test | Yes (`sam local invoke`) | Yes (runtime API level) |
| Docker required for local run | No (default) | Yes | Yes (typical usage) |
| Cloud deploy capability | Yes (`serverless deploy`) | Yes (`sam deploy`) | No |
| Direct fit for this repo now | Yes | No (template migration needed) | No (manual wiring needed) |

## 3. SAM Commands (Exact Scope)
- `sam local start-api`
  - Input: SAM template + HTTP request
  - Output: local HTTP response
  - Behavior: converts HTTP request to API Gateway-style event and invokes local Lambda container
- `sam local invoke`
  - Input: function logical ID + event JSON
  - Output: one function execution result
  - Behavior: no HTTP router; one-shot invocation
- `sam validate`
  - Input: SAM template
  - Output: template validity result
  - Behavior: static validation only (no function run)
- `sam validate --lint`
  - Input: SAM template
  - Output: additional rule-based findings (`cfn-lint`)
  - Behavior: stricter static checks than plain `validate`
- `sam sync`
  - Input: local changes + target stack
  - Output: updated cloud stack/resources
  - Behavior: cloud synchronization command (not local emulation)

## 4. Local vs Cloud Coverage

| Check Item | `dev:local` (`tsx`) | `sls:offline` | AWS dev deploy |
| --- | --- | --- | --- |
| Uses Lambda handler entry (`dist/index.handler`) | No | Yes | Yes |
| Uses API Gateway-like event pipeline | No | Yes | Yes |
| Uses local DynamoDB endpoint (`IS_OFFLINE=true`) | Yes | Yes (`--stage local`) | No |
| Real IAM policy enforcement | No | No | Yes |
| Real CloudFront/API Gateway managed service path | No | No | Yes |

## 5. Environment Variable Handling
- API
  - Source at deploy: `${env:...}` in `apps/api/serverless.yml`
  - Runtime read: `process.env` in Lambda
  - Change reflection: requires redeploy
- Web
  - Source at build: `VITE_*` env (file or CI env)
  - Runtime in browser: baked into build artifact
- `JWT_SECRET`
  - Required and fixed across deployments (`apps/api/src/index.ts`)
