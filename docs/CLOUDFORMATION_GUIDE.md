# CloudFormation & Serverless Framework 학습 노트

이번 배포 과정에서 경험한 AWS CloudFormation과 Serverless Framework의 작동 원리를 정리한 문서입니다.

## 1. Serverless Framework와 CloudFormation의 관계

Serverless Framework(`sls`)는 독자적인 배포 도구가 아니라, **CloudFormation 템플릿 생성기**에 가깝습니다.

1. 개발자가 `serverless.yml`을 작성합니다.
2. `sls deploy` 명령어를 실행하면:
   - `serverless.yml`이 AWS의 **CloudFormation Template (JSON/YAML)** 으로 변환됩니다.
   - 변환된 템플릿이 S3 배포 버킷(`serverlessdeploymentbucket`)에 업로드됩니다.
   - CloudFormation에 "이 템플릿대로 스택을 만들어/업데이트해줘"라고 요청합니다.

즉, **모든 배포의 실체는 CloudFormation Stack**입니다.

## 2. 배포(Deploy)의 작동 원리: Change Set

`sls deploy`를 다시 실행했을 때 "이미 배포된 건데 또 돌려도 되나?"에 대한 답은 **"된다"** 입니다. CloudFormation의 **상태 기반 관리(State Management)** 덕분입니다.

### 동작 과정

1. **현재 상태 확인**: CloudFormation은 현재 AWS에 배포된 리소스 상태를 알고 있습니다.
2. **변경 감지**: 새로 업로드된 템플릿과 현재 상태를 비교합니다.
3. **Change Set 생성**: "무엇이 바뀌었는지" 목록을 만듭니다.
   - 예: CloudFront의 `PriceClass`가 `100` -> `All`로 변경됨
   - 예: S3 버킷 설정은 변경 없음
4. **업데이트 실행**:
   - 변경된 리소스만 수정(Update)합니다. (예: CloudFront 설정 변경)
   - 변경 없는 리소스는 건드리지 않습니다. (예: S3 파일 보존)
   - 더 이상 필요 없는 리소스는 삭제(Delete)합니다.

따라서 배포 명령어를 여러 번 실행해도 안전하며, 변경사항이 없으면 "No changes to deploy"라고 뜨고 끝납니다.

## 3. 리소스(Resources) 섹션

`serverless.yml`의 `resources` 섹션은 CloudFormation 문법을 그대로 사용합니다.

```yaml
resources:
  Resources:
    MyBucket:
      Type: AWS::S3::Bucket # CloudFormation 리소스 타입
      Properties:
        BucketName: my-bucket
```

- **Type**: 만들고 싶은 AWS 리소스 종류 (S3, DynamoDB, IAM Role 등)
- **Properties**: 해당 리소스의 구체적인 설정
- **CloudFormation 문서**: 구글에 `AWS::S3::Bucket` 등으로 검색하면 나오는 공식 문서의 프로퍼티를 그대로 사용할 수 있습니다.

## 4. 커스텀 에러 트러블슈팅

### "Invalid request provided: Exactly one of..."

- **원인**: CloudFormation이 리소스를 생성할 때 논리적으로 말이 안 되는 설정을 발견하고 거부한 것입니다.
- **예시**: CloudFront Origin 설정에 `S3OriginConfig`(REST API용)와 `CustomOriginConfig`(웹사이트용)를 동시에 넣었을 때.

### "Stack ... failed to deploy"

- Serverless Framework 오류가 아니라, **CloudFormation Stack 업데이트가 실패**한 것입니다.
- AWS Console > CloudFormation > 해당 스택 > **Events** 탭을 보면 정확히 어떤 리소스 생성에 실패했는지(빨간색 글씨) 상세 로그를 볼 수 있습니다.

## 5. 배포 버킷 vs 서비스 버킷

`serverless.yml` 하나로 배포했는데 S3 버킷이 여러 개 생기는 이유:

1. **Deployment Bucket** (`...-serverlessdeploymentbucket-...`)
   - **용도**: 배포 "과정"을 위한 임시 저장소
   - **내용물**: 변환된 CloudFormation 템플릿 파일, Lambda zip 파일 등
   - Serverless Framework가 자동으로 생성하고 관리합니다.

2. **Service Bucket** (`my-commit-web-sb-dev`)
   - **용도**: 실제 우리가 만든 서비스(웹사이트)를 위한 저장소
   - **내용물**: `index.html`, `bundle.js`, 이미지 등
   - 우리가 `resources` 섹션에서 명시적으로 정의한 리소스입니다.

## 6. CloudFront 배포 소요 시간과 CLI 대기 원리

`PriceClass` 변경이나 커스텀 도메인 설정 등 CloudFront 관련 변경사항이 포함된 배포는 시간이 매우 오래 걸릴 수 있습니다 (5분 ~ 20분).

### 1) 왜 오래 걸리는가? (Stabilization)

CloudFormation은 단순히 리소스 생성 요청만 보내고 끝내는 것이 아니라, 해당 리소스가 **"완전히 사용 가능한 상태(Stabilized)"**가 될 때까지 기다립니다.

- CloudFront의 경우: "전 세계 수백 개의 엣지 로케이션에 설정이 모두 전파 완료됨" 상태가 되어야 "배포 완료"로 간주합니다.
- 물리적으로 전 세계 서버에 복제되는 시간이 필요하므로 오래 걸립니다.

### 2) 왜 터미널(CLI)이 멈춰 있는가? (Polling)

Serverless CLI(`sls deploy`)는 CloudFormation Stack의 상태를 주기적으로 확인(Polling)합니다.

- CLI: "다 됐어?"
- AWS: "아직 진행 중(UPDATE_IN_PROGRESS)"
- ... (5분 경과) ...
- CLI: "다 됐어?"
- AWS: "완료됨(UPDATE_COMPLETE)"
- CLI: "성공!" (종료)

**결론**: 터미널이 멈춘 것처럼 보이는 것은 **CloudFormation이 리소스 안정화를 기다리고 있고, CLI는 그 결과를 기다리고 있기 때문**입니다. 강제로 종료(Ctrl+C)해도 AWS 내부에서는 작업이 계속 진행되지만, 배포 성공 여부를 확인하기 위해 기다리는 것을 권장합니다.
