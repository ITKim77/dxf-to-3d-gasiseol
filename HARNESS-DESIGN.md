# 하네스 설계 상세 문서 (단계 7)

> Anthropic 엔지니어링 블로그 "harness-design-long-running-apps" 기반
> DXF to 3D 프로젝트의 구체적인 구현

---

## 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [에이전트 의존성](#에이전트-의존성)
3. [체크포인트 시스템](#체크포인트-시스템)
4. [오류 복구](#오류-복구)
5. [상태 관리](#상태-관리)
6. [모니터링](#모니터링)

---

## 아키텍처 개요

### 설계 원칙

```
복잡한 작업 (DXF → 웹앱)
    ↓
단위별 분해 (4개 에이전트)
    ↓
파일 기반 핸드오프 (JSON/JS/OBJ)
    ↓
자동 검증 (4단계)
    ↓
오류 시 부분 복구 (체크포인트)
```

### 왜 이 설계인가?

| 설계 요소 | 문제 해결 |
|---------|---------|
| Tractable Chunks | 큰 작업이 한 에이전트를 압도하는 것 방지 |
| Structured Artifacts | 에이전트 간 통신의 신뢰성 보장 |
| 체크포인트 | 실패 후 처음부터 다시 시작하는 낭비 방지 |
| 다층 검증 | 조용히 틀리는 오류 조기 발견 |

---

## 에이전트 의존성

### 의존성 그래프

```
입력 레이어:
    RAG/가시설_*.dxf (7개 파일)
            ↓
처리 레이어 1 (병렬 가능):
    ┌───────────────────┬────────────────┐
    ↓                   ↓
[Research Agent]   [WebUI Agent]
도면 분석            웹앱 개발
설정 파일 생성      (독립적)
    ↓
src/drawings/gasiseol.mjs
    ↓
처리 레이어 2 (순차):
[Pipeline Agent]
    3D 생성
    부피 검증
    ↓
out/gasiseol.obj, out/gasiseol.ifc
    ↓
검증 레이어:
[Validator]
    4단계 검증
    기준값 저장
    ↓
baselines/gasiseol.volumes.json
    ↓
출력 레이어:
[Deploy Agent]
    웹 빌드
    Vercel 배포
    ↓
https://dxf-to-3d.tk
```

### 병렬 실행 전략

```
Timeline (최악의 경우):

Sequential (순차):
  Research (5분) → Pipeline (10분) → Deploy (5분) = 20분

Parallel (병렬, 이상적):
  Research (5분)  ──┐
  WebUI (10분) ────┼→ Pipeline (10분) → Deploy (5분) = 25분
                   (여전히 더 빠름: 25 < 30)

실제 구현:
  1. Research + WebUI 동시 시작
  2. Research 완료 대기
  3. Pipeline 시작
  4. WebUI 완료 (이미 끝남)
  5. Deploy 시작
```

### 의존성 테이블

| 에이전트 | 입력 파일 | 출력 파일 | 선행 요구 |
|---------|---------|---------|---------|
| Research | RAG/*.dxf | src/drawings/gasiseol.mjs | 없음 |
| Pipeline | src/drawings/gasiseol.mjs | out/gasiseol.obj | Research ✓ |
| WebUI | out/gasiseol.obj | src/web/ | 없음 (선택) |
| Deploy | src/web/, out/gasiseol.obj | https://dxf-to-3d.tk | Pipeline ✓ |
| Validator | 모든 파일 | baselines/gasiseol.volumes.json | Pipeline ✓ |

---

## 체크포인트 시스템

### 체크포인트 지점

각 에이전트 완료 후 자동 저장:

```
1️⃣ Research 완료
   └─ 저장: .claude/artifacts/gasiseol-cp-1-research.json
      내용: {
        timestamp: "2026-10-19T14:30:00Z",
        agent: "research",
        output: "src/drawings/gasiseol.mjs",
        status: "success|fail",
        error: "..." (if fail)
      }

2️⃣ Pipeline 완료
   └─ 저장: .claude/artifacts/gasiseol-cp-2-pipeline.json
      내용: {
        timestamp: "2026-10-19T14:45:00Z",
        agent: "pipeline",
        output: "out/gasiseol.obj",
        volumes: { irVolume, realVolume, error },
        status: "success|fail"
      }

3️⃣ WebUI 완료
   └─ 저장: .claude/artifacts/gasiseol-cp-3-webui.json

4️⃣ Deploy 완료
   └─ 저장: .claude/artifacts/gasiseol-cp-4-deploy.json
      내용: {
        url: "https://dxf-to-3d.tk",
        timestamp: "...",
        status: "success|fail"
      }
```

### 체크포인트 저장 방식

```bash
# Research 완료 후
cat > .claude/artifacts/gasiseol-cp-1.json << 'EOF'
{
  "stage": 1,
  "agent": "research",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "output_file": "src/drawings/gasiseol.mjs",
  "status": "success",
  "md5": "$(md5sum src/drawings/gasiseol.mjs | cut -d' ' -f1)"
}
EOF
```

---

## 오류 복구

### 복구 전략

#### Scenario 1: Research 실패

```
상황: DXF 분석 오류
영향: 설정 파일 미생성

복구:
  1. 오류 로그 분석 (.claude/artifacts/debug-research.log)
  2. DXF 파일 검증
  3. Research 재실행
  4. 기준점 수동 지정 (필요시)
  5. /validate --level=2 (기하학만 검증)

비용: 5분
영향 받음: 나머지 모든 단계 (차단)
```

#### Scenario 2: Pipeline 실패

```
상황: 부피 오차 > 0.5%
영향: 3D 모델 부정확

복구:
  1. IR 부피 vs 실제 부피 비교
  2. Boolean 손실 확인 (modelCount)
  3. assemble() 함수 재검토
  4. Research 결과 파일 유지 (체크포인트 사용)
  5. Pipeline만 재실행

비용: 10분
영향 받음: Deploy (차단)
```

#### Scenario 3: WebUI 실패

```
상황: React 빌드 오류
영향: 웹앱 미생성

복구:
  1. TypeScript 오류 확인
  2. 의존성 설치 재시도 (npm ci)
  3. WebUI만 재실행
  4. Research, Pipeline은 유지

비용: 10분
영향 받음: Deploy (차단)
```

#### Scenario 4: Deploy 실패

```
상황: Vercel 배포 오류
영향: 웹사이트 미업데이트

복구:
  1. GitHub Actions 로그 확인
  2. 환경 변수 검증
  3. Deploy만 재실행
  4. 나머지는 모두 유지

비용: 5분
영향 받음: 사용자 (임시)
```

### 복구 검사목록

각 에이전트 재실행 후:

```
☐ 출력 파일 존재?
☐ 파일 크기 > 0?
☐ 스키마 유효?
☐ /validate 통과?
☐ 기준값 변경 없음? (회귀)
☐ PROGRESS.md 업데이트?
```

---

## 상태 관리

### PROGRESS.md 상태 머신

```
┌─────────────────────────────────────────┐
│ Idle                                    │
└─────────────────┬───────────────────────┘
                  ↓ /convert gasiseol
        ┌─────────────────────┐
        │ Stage 1: Research   │
        └─────────┬───────────┘
                  ↓ (Research 완료)
        ┌─────────────────────┐
    ┌───┤ Stage 2: Pipeline   │◄──┐ (실패 시 루프)
    │   └─────────┬───────────┘   │
    │             ↓               │
    │   (Pipeline 통과)           │
    │             ↓               │
    └──────────────────────────────┘
              (재실행)

                  ↓ (성공)
        ┌─────────────────────┐
    ┌───┤ Stage 3: WebUI+Dep  │◄──┐
    │   └─────────┬───────────┘   │
    │             ↓               │
    │   (배포 완료)               │
    │             ↓               │
    └──────────────────────────────┘
```

### PROGRESS.md 작성 규칙

```markdown
## 현재 상태

### ✅ 완료
- [x] Research
  - 기준점 검출: OK
  - 뷰 분리: OK
  - 설정 파일: src/drawings/gasiseol.mjs

### 🔄 진행 중
- [ ] Pipeline
  - 3D 생성: 진행 중...
  - 부피 검증: 대기 중

### ⏳ 예정
- [ ] WebUI
- [ ] Deploy

### ⚠️ 오류 (있으면)
- [ ] Pipeline 부피 오차 > 0.5%
  해결: assemble() 함수 재검토 필요
```

---

## 모니터링

### 자동 모니터링 훅

#### post-commit 훅 (매 커밋 후)

```bash
# 대상 파일 변경 감지
if git diff --cached --name-only | grep -qE "src/drawings/|RAG/"; then
  
  # 자동 검증
  node src/build.mjs gasiseol --validate
  
  if [ $? -ne 0 ]; then
    # 오류 시 경고
    echo "⚠️ DXF 설정 오류 감지"
    echo "상세: node src/build.mjs gasiseol --loops"
  fi
fi
```

#### pre-deploy 훅 (배포 전)

```bash
# 모든 검증 통과 확인
/validate --level=full

# 실패 시 배포 중단
if [ $? -ne 0 ]; then
  echo "❌ 배포 취소: 검증 실패"
  exit 1
fi
```

### 수동 모니터링

```bash
# 현재 상태 확인
/report

# 상세 검증
/validate --level=full

# 성능 분석
/web-dev --analyze

# 부피 회귀 테스트
node src/measure.mjs gasiseol --ir --compare-baseline
```

---

## 실행 흐름 예시

### 성공 경로 (Happy Path)

```
1. /convert gasiseol
   ├─ Research: ✅ (2분)
   ├─ Pipeline: ✅ (8분)
   ├─ WebUI: ✅ (병렬 동안)
   └─ Deploy: ✅ (4분)
   
   총 소요: ~15분
   결과: https://dxf-to-3d.tk ✅
```

### 오류 + 복구 경로

```
1. /convert gasiseol
   ├─ Research: ✅
   ├─ Pipeline: ❌ (부피 오차 1.2%)
   │  └─ 체크포인트: .claude/artifacts/gasiseol-cp-1.json
   │  └─ 원인: assemble() 함수 오류
   │
   └─ 복구:
      1. assemble() 함수 수정
      2. Pipeline 재실행
      3. /validate --level=3 (3D 검증만)
      4. ✅ 부피 오차 0.3%
      5. Deploy 진행
      
   추가 소요: ~10분
   총: ~25분
```

---

## 베스트 프랙티스

### ✅ 해야 할 것

```
✓ 매 에이전트 완료 후 체크포인트 저장
✓ 오류 시 즉시 원인 파악
✓ PROGRESS.md 상태 유지
✓ 부분 실패 시 해당 에이전트만 재실행
✓ 기준값과 항상 비교 (회귀 방지)
✓ 성공/실패 모두 로그 기록
```

### ❌ 하면 안 되는 것

```
✗ 오류 무시하고 다음 단계 진행
✗ 중간 파일 직접 수정 (에이전트가 신뢰할 수 없음)
✗ 체크포인트 없이 전체 재실행
✗ 기준값 무시 (오차율 승인 없이)
✗ 에이전트 간 상태 공유 (파일 기반만 사용)
✗ 로그 미기록 (추적 불가)
```

---

## 변경 이력

- 2026-10-19: 초안 작성 (단계 7)

