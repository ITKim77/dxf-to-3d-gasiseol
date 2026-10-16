# PLAN.md — 상세 계획 및 에이전트 역할

> **PROGRESS.md의 예정 항목을 상세히 풀어 쓴 것입니다.**  
> 각 단계 시작 전에 여기서 자신의 역할을 확인하세요.

---

## 전체 일정 (단계 4~9)

```
단계 4  →  단계 5  →  단계 6  →  단계 7  →  단계 8  →  단계 9
  ↓         ↓         ↓         ↓         ↓         ↓
계획     아이디어    구현     보강       병렬화     모델확정
2일      2일       3일      1일       2일       1일
        (총 ~12일)
```

---

## 단계 4: PROGRESS.md & PLAN.md 작성 ✅ (완료)

### 목표
- PROGRESS.md: 진행 상황 추적용 (에이전트가 매 세션 읽기)
- PLAN.md: 상세 계획 및 에이전트 역할 (이 파일)

### 완료 기준
- [ ] PROGRESS.md 작성 (2026-10-16)
- [ ] PLAN.md 작성 (지금)
- [ ] 메모리에 저장

### 산출물
- `PROGRESS.md`: 현재 상태, 완료 단계, 예정 항목
- `PLAN.md`: 상세 계획 (이 파일)

---

## 단계 5: 에이전트/커맨드/스킬 아이디어 제안

### 목표
Claude Code의 에이전트, 커맨드, 스킬, 훅 구조를 이해하고, 이 프로젝트에 필요한 것들을 제안한다.

### 작업 항목

#### 5.1 에이전트 설계
```
4개 에이전트 (병렬 처리 가능):

[Agent-Research]
목적: 가시설 도면 분석 & 설정 파일 작성
담당: DXF 파싱, 좌표 검증, 기하학 분석
주요 스킬: Grep (도면 패턴 찾기), 계산
입력: 원본 DXF 파일
출력: src/drawings/gasiseol.mjs (설정 파일)

[Agent-Pipeline]
목적: dwg2model 파이프라인 최적화 & 테스트
담당: 빌드, 검증, 부피 측정
주요 커맨드: node src/run.mjs, node src/build.mjs, node src/measure.mjs
입력: 설정 파일 (src/drawings/gasiseol.mjs)
출력: IR (중간 표현), 검증 리포트

[Agent-WebUI]
목적: React 웹앱 & Three.js 통합
담당: UI 컴포넌트, 3D 뷰어, API
주요 기술: React, Three.js, TypeScript
입력: 3D 모델 (OBJ/IFC)
출력: 웹앱 (src/web/)

[Agent-Deploy]
목적: CI/CD, 배포, 도메인 설정
담당: GitHub Actions, Vercel, 도메인
주요 도구: git, npm, gh CLI
입력: 웹앱 소스 코드
출력: 배포된 웹사이트 + 무료 도메인
```

#### 5.2 커맨드 설계
```
프로젝트 특화 커맨드 (구현 예정):

/step-X          단계별 워크플로우 실행
/validate        도면 & 3D 모델 자동 검증
/convert         DXF → 3D 한 번에 (3개 에이전트 병렬)
/deploy          웹앱 배포 (CI/CD 자동)
/report          진행 상황 & 검증 결과 리포트
```

#### 5.3 스킬 설계
```
프로젝트 특화 스킬:

/dxf-analyze
  입력: DXF 파일
  출력: 도면 분석 리포트 (좌표 범위, 레이어, 엔티티 수)
  
/3d-validate
  입력: OBJ 또는 IFC 파일
  출력: 검증 리포트 (manifold, 부피, 면 수)
  
/web-dev
  입력: 3D 모델
  출력: 웹앱 로컬 서버 실행
  
/ci-setup
  입력: 저장소 설정
  출력: GitHub Actions 워크플로우 파일
```

#### 5.4 훅 설계
```
자동 실행 훅 (settings.json):

[git commit 후]
훅: 자동 검증
  → node src/measure.mjs <도면> 실행
  → 부피 변화 감지
  → 문제 시 경고

[PROGRESS.md 수정 후]
훅: 상태 반영
  → 다음 세션에 알림

[배포 전]
훅: 모든 테스트 통과 확인
  → npm run test
  → npm run lint
  → node src/build.mjs --validate
```

### 완료 기준
- [ ] 4개 에이전트 정의 (이름, 목적, 담당, 입출력)
- [ ] 5개 커맨드 아이디어 제안
- [ ] 3개 스킬 아이디어 제안
- [ ] 4개 훅 아이디어 제안
- [ ] 사용자 승인 받기

### 산출물
- 텍스트 문서 또는 이 파일 확장

### 의존성
- 단계 4 완료 후

---

## 단계 6: Claude Code 구조 조사 및 정확한 포맷 구현

### 목표
Claude Code의 공식 에이전트, 커맨드, 스킬, 훅 포맷을 학습하고, 단계 5의 아이디어를 정확한 포맷으로 구현한다.

### 작업 항목

#### 6.1 Claude Code 구조 조사
```
학습 대상:
  - .claude/agents/*.md 포맷 (에이전트 정의)
  - .claude/commands/*.yaml 포맷 (커맨드)
  - .claude/skills/*.yaml 포맷 (스킬)
  - settings.json hooks 포맷 (자동 실행)
  
공식 문서:
  - /help claude-code
  - /help agents
  - https://claude.com/claude-code (설명)
```

#### 6.2 정확한 포맷으로 구현
```
폴더 구조:
D:\Obsidian Vault\999ETC\261016_HW_DwfTo3D\.claude\
├── agents/
│   ├── dxf-research.md         [Agent-Research]
│   ├── pipeline-build.md        [Agent-Pipeline]
│   ├── web-ui-dev.md           [Agent-WebUI]
│   └── deploy-ci.md            [Agent-Deploy]
│
├── commands/
│   ├── step.yaml               (/step-X)
│   ├── validate.yaml           (/validate)
│   ├── convert.yaml            (/convert)
│   └── deploy.yaml             (/deploy)
│
├── skills/
│   ├── dxf-analyze.yaml        (/dxf-analyze)
│   ├── 3d-validate.yaml        (/3d-validate)
│   └── web-dev.yaml            (/web-dev)
│
└── settings.json
    └── hooks: [자동 실행 규칙]
```

#### 6.3 각 파일의 내용
```
agents/dxf-research.md:
  - name: 도면 분석 & 설정 파일
  - description: DXF 파일 파싱, 좌표 검증, 설정 파일 작성
  - tools: [Read, Edit, Write, Grep, Bash]
  - instructions: [...상세 지침...]

commands/convert.yaml:
  - name: convert
  - description: DXF → 3D 변환 (병렬 처리)
  - agents:
      - dxf-research (stage 1)
      - pipeline-build (stage 2)
      - web-ui-dev (stage 3)
  - sequential: false  (병렬 실행)

skills/dxf-analyze.yaml:
  - 트리거: /dxf-analyze <파일>
  - 실행: Agent-Research 호출
  - 결과: 도면 분석 리포트
```

### 완료 기준
- [ ] .claude/ 폴더 구조 생성
- [ ] 4개 에이전트 정의 파일 작성
- [ ] 4개 커맨드 파일 작성
- [ ] 3개 스킬 파일 작성
- [ ] settings.json 훅 설정
- [ ] 모든 파일 git 커밋

### 산출물
```
.claude/ 폴더 완성
├── agents/ (4개 파일)
├── commands/ (4개 파일)
├── skills/ (3개 파일)
└── settings.json (훅 포함)
```

### 의존성
- 단계 5 완료 + 아이디어 승인 후
- Claude Code 공식 문서 학습 필요

---

## 단계 7: 추가 하네스 및 보강

### 목표
Anthropic 엔지니어링 블로그의 "harness-design-long-running-apps" 자료를 읽고, 장기 실행 앱 설계를 프로젝트에 적용한다.

### 작업 항목

#### 7.1 하네스 개념 학습
```
읽을 자료:
https://www.anthropic.com/engineering/harness-design-long-running-apps

학습 항목:
  - 에이전트 상태 관리
  - 장기 실행 작업의 진행률 추적
  - 오류 복구 전략
  - 단계별 검증 포인트
```

#### 7.2 프로젝트에 적용
```
개선 사항:
  1. 에이전트 체크포인트
     - 각 에이전트의 중간 결과 저장
     - 실패 시 재개 가능

  2. 진행 상황 실시간 추적
     - PROGRESS.md 자동 업데이트
     - 웹 대시보드 (옵션)

  3. 롤백 가능성
     - git 커밋 포인트 명확
     - 문제 시 이전 버전 복구

  4. 재시도 로직
     - 네트워크 오류 시 재시도
     - 지수 백오프
```

#### 7.3 CLAUDE.md 업데이트
```
추가 내용:
  - 에이전트 체크포인트 정의
  - 오류 복구 절차
  - 진행 상황 모니터링
  - 롤백 가이드
```

### 완료 기준
- [ ] 하네스 설계 개념 문서 작성
- [ ] 프로젝트 구조 다이어그램 (상태 관리)
- [ ] CLAUDE.md 보강
- [ ] 에이전트에 체크포인트 로직 추가

### 산출물
- 보강된 CLAUDE.md
- 하네스 설계 다이어그램
- 각 에이전트의 체크포인트 정의

### 의존성
- 단계 6 완료 후

---

## 단계 8: 동적 에이전트 + 병렬화 워크플로우 구현

### 목표
복합 작업을 여러 에이전트가 병렬로 처리하는 워크플로우를 구현한다. 안정성을 유지하면서 속도를 높인다.

### 작업 항목

#### 8.1 병렬 처리 구조
```
사용자 입력
  ↓
Orchestrator 에이전트
  ├─→ [Agent-Research] 
  │   (DXF 분석, 설정 파일)
  │
  ├─→ [Agent-Pipeline]
  │   (빌드, 검증)
  │   (Research 완료 대기)
  │
  └─→ [Agent-WebUI]
      (UI 개발)
      (Pipeline 완료 대기)

병렬화 규칙:
  - Research와 WebUI: 병렬 가능
  - Pipeline: Research 완료 후 시작
  - 최종 병합: 모든 에이전트 완료 대기
```

#### 8.2 워크플로우 정의 (코드 또는 설정)
```
example: convert.yaml

stages:
  stage1:
    agents:
      - dxf-research
    parallel: false
    
  stage2:
    agents:
      - pipeline-build
    depends_on: stage1
    parallel: false
    
  stage3:
    agents:
      - web-ui-dev
    parallel: true  (stage1과 동시)
    
  stage4:
    agents:
      - orchestrator (병합)
    depends_on: [stage2, stage3]
```

#### 8.3 안정성 보장
```
체크포인트 전략:
  - 각 stage 시작 전: 상태 저장
  - 각 stage 완료 후: 결과 검증
  - 실패 시: 해당 stage부터 재시작
  
타임아웃:
  - Research: 5분
  - Pipeline: 10분
  - WebUI: 10분
  - 전체: 30분
  
에러 처리:
  - 중단 불가: Research + WebUI (서로 독립)
  - 중단 가능: Pipeline 실패 → 전체 실패
```

#### 8.4 모니터링 대시보드 (옵션)
```
실시간 추적:
  ├─ 각 에이전트 진행률
  ├─ 현재 병목 지점
  ├─ 예상 완료 시간
  └─ 오류 알림

구현:
  - 웹 UI (React)
  - 또는 CLI 대시보드
```

### 완료 기준
- [ ] 워크플로우 YAML 정의
- [ ] Orchestrator 에이전트 구현
- [ ] 병렬 실행 테스트 (2회 이상)
- [ ] 오류 복구 테스트
- [ ] 모니터링 (CLI 또는 웹)

### 산출물
- .claude/commands/convert.yaml (병렬 워크플로우)
- Orchestrator 에이전트 구현
- 워크플로우 다이어그램
- 테스트 리포트

### 의존성
- 단계 7 완료 후

---

## 단계 9: 모델 선택 확정

### 목표
Haiku 4.5로 작업한 결과를 평가하고, 필요시 더 강력한 모델로 전환할지 결정한다.

### 작업 항목

#### 9.1 성능 평가
```
평가 항목:
  - 코드 품질 (정확성, 버그)
  - 개발 속도 (각 단계별 소요 시간)
  - 결과물 품질 (웹앱 기능성, 3D 정확도)
  - 비용 (Haiku 비용 vs 상위 모델)

기준:
  ✅ Haiku 충분: 모든 항목 80점 이상
  △ 개선 필요: 1~2개 항목 60~80점
  ❌ Haiku 부족: 2개 이상 항목 60점 미만
```

#### 9.2 대안 평가
```
모델 선택지:
  
  현재: Claude Haiku 4.5
  - 비용: 저 (토큰당 0.80/3.2)
  - 속도: 매우 빠름
  - 추론: 기본적 작업 우수
  
  대안 1: Claude Sonnet 5
  - 비용: 중 (3/15)
  - 속도: 빠름
  - 추론: 복잡한 구조 이해 우수
  
  대안 2: Claude Opus 5
  - 비용: 높음 (15/60)
  - 속도: 느림
  - 추론: 최고 수준
```

#### 9.3 의사결정
```
선택 기준:

Haiku 유지:
  ✓ 결과물 품질 만족
  ✓ 개발 일정 충족
  ✓ 비용 절감 (목표)

→ Sonnet 전환:
  ✗ 정확도 부족 (3D 모델 오류)
  ✗ 개발 지연 (단계별 시간 초과)
  ✗ 특정 기술 이해 미흡

→ Opus 전환:
  ✗ Sonnet도 부족한 경우만
  ✗ 비용 대폭 증가
```

### 완료 기준
- [ ] 1단계별 소요 시간 기록
- [ ] 코드 품질 평가 (린트, 테스트)
- [ ] 3D 모델 정확도 검증
- [ ] 웹앱 기능 평가
- [ ] 최종 모델 결정

### 산출물
- 평가 리포트 (성능 지표)
- 모델 선택 의사결정 문서

### 의존성
- 단계 8 완료 + 전체 구현 완료 후

---

## 크리티컬 패스

```
                    단계 5 (아이디어)
                          ↓
    단계 4 (계획) → 단계 6 (구현) → 단계 7 (보강)
                          ↓                    ↓
                                        단계 8 (병렬화)
                                              ↓
                                        단계 9 (평가)

병목:
  - 단계 5→6: 포맷 학습 (1일)
  - 단계 6→7: 구조 확정 (1일)
  - 단계 8: 병렬 안정성 (2일)
```

---

## 리스크 및 완화책

| 단계 | 리스크 | 완화책 |
|------|--------|--------|
| 5 | 아이디어 과다 | 핵심만 4개 에이전트로 제한 |
| 6 | 포맷 불일치 | 공식 문서 읽고 예제 확인 |
| 7 | 복잡도 증가 | 단계별 검증점 명확 |
| 8 | 병렬 관리 어려움 | Orchestrator 패턴 활용 |
| 9 | 모델 전환 비용 | 초기 평가 명확 기준 설정 |

---

## 변경 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| 1.0 | 2026-10-16 | 초안 (단계 4) |

