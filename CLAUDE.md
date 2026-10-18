# CLAUDE.md — DXF to 3D Web App 프로젝트 가이드

> **이것은 AI 에이전트를 위한 프로젝트 지침서입니다.**  
> 이 파일을 먼저 읽고 작업을 시작하세요.

---

## 프로젝트 개요

### 목표
2D DXF 도면(가시설 일반도)을 분석하여 3D 모델로 변환하고, 웹상에서 실시간으로 검토할 수 있는 웹앱을 만든다.

### 최종 산출물
```
사용자 → 웹사이트 (무료 도메인)
          ↓
        DXF 업로드 & 자동 변환
          ↓
        3D 모델 실시간 시각화
          ↓
        부재 정보 조회, 측정, 다운로드
```

### 핵심 요구사항
- ✅ **Git 관리**: 모든 작업 과정 기록
- ✅ **무료 배포**: Vercel + 커스텀 도메인
- ✅ **품질**: Haiku 4.5 모델임에도 우수한 결과물
- ✅ **단계별 검증**: 각 단계 전에 작업 리마인드 + 진행 확인

---

## 프로젝트 구조

```
D:\Obsidian Vault\999ETC\261016_HW_DwfTo3D\
│
├── docs/                          # 기초 자료 (읽기 전용)
│   ├── roadmap.md                 # 진행 상황 & 우선순위
│   ├── 2d-3d-conversion.md        # 19개 교훈 (매우 중요!)
│   ├── 2d-3d-process.md           # 절차 문서
│   ├── methodology.html           # 방법론 상세
│   └── dwg2model-CLAUDE.md        # 기존 프로젝트 가이드
│
├── RAG/                           # 대상 DXF 파일
│   ├── 가시설_평면.dxf            # 평면도
│   ├── 가시설_단면.dxf            # 단면도
│   └── 가시설_상세1~4.dxf        # 상세도
│
├── src/                           # 소스 코드 (구현 예정)
│   ├── drawings/
│   │   ├── index.mjs              # 모든 도면의 중앙 진입점
│   │   └── gasiseol.mjs           # 가시설 도면 설정 & 조립 로직
│   │
│   ├── core/                      # 도면 고유값 없음 (절대 건드리지 말 것)
│   │   ├── parse.mjs              # DXF 파싱
│   │   ├── views.mjs              # 뷰 분리
│   │   ├── loops.mjs              # 폐곡선 추출
│   │   └── datum.mjs              # 기준점 검출
│   │
│   ├── build/                     # IR 생성 (도면 독립)
│   │   ├── assemble.mjs           # 부재 조립
│   │   └── validate.mjs           # 검증
│   │
│   ├── emit/                      # 3D 출력 (도면 독립)
│   │   ├── egm.mjs                # EGModeler 명령 생성
│   │   └── ifc.mjs                # IFC 출력
│   │
│   ├── web/                       # React 웹앱 (새로)
│   │   ├── components/
│   │   │   ├── Viewer3D.tsx       # Three.js 뷰어
│   │   │   ├── FileUpload.tsx     # DXF 업로드
│   │   │   ├── PropertyPanel.tsx  # 부재 정보
│   │   │   └── Controls.tsx       # 조작 UI
│   │   ├── pages/
│   │   │   ├── index.tsx          # 메인 페이지
│   │   │   └── api/convert.ts     # 변환 API
│   │   ├── styles/
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── run.mjs                    # 도면 검증 (기존)
│   ├── build.mjs                  # IR 생성 (기존)
│   ├── measure.mjs                # 부피 측정 (기존)
│   └── paths.mjs                  # 경로 관리 (한 곳)
│
├── .claude/                       # 에이전트 설정 (단계 6에서)
│   ├── agents/
│   │   ├── research.md
│   │   ├── pipeline.md
│   │   ├── webui.md
│   │   └── deploy.md
│   ├── commands/
│   ├── skills/
│   └── hooks/
│
├── PROGRESS.md                    # 진행 상황 추적 (매 세션 업데이트)
├── PLAN.md                        # 상세 계획 및 에이전트 역할 분담
├── CONSIDERATIONS.md              # 고려사항 (단계 2 결과)
├── CLAUDE.md                      # 이 파일
│
└── .gitignore                     # git 설정
    node_modules/
    dist/
    *.obj
    *.log
```

---

## 개발 워크플로우

### 0️⃣ 세션 시작 전
```
1. PROGRESS.md 읽기      ← 진행 상황 파악
2. PLAN.md 읽기          ← 다음 작업 확인
3. 메모리 로드          ← 이전 세션 컨텍스트
```

### 1️⃣ 각 단계 시작 시
```
리마인드 (작업 내용 명시화)
  ├─ 이 단계에서 할 것
  ├─ 예상 결과물
  └─ 성공 기준

진행 확인 (사용자 승인)
  └─ "다음으로 진행해도 될까요?" → 대기

작업 수행 (git 커밋 포함)
  └─ 의미 있는 커밋 메시지

검증 (문제 없는지 확인)
  └─ 자동 테스트 또는 수동 검사

완료 리포트 (PROGRESS.md 업데이트)
  └─ 결과물 요약 & 다음 단계 예고
```

### 2️⃣ Git 커밋 원칙
```
좋은 예시:
  step2: CONSIDERATIONS.md 작성 - 고려사항 8개 영역 정리
  step3: CLAUDE.md 작성 - 프로젝트 구조 & 워크플로우 정의
  
나쁜 예시:
  ❌ update (너무 모호)
  ❌ fix bugs (어떤 버그?)
  ❌ step1-draft (완료 전 중간 저장)
```

---

## 핵심 원칙 (반드시 지킬 것)

### 🚫 절대 어기면 안 되는 경계
```
src/core/*  ·  src/build/*     → 도면 고유값 금지 (= 설정파일로 분리)
src/drawings/*.mjs             → 레이어명, 좌표, 단위 모두 여기
src/web/*                      → 웹앱만 담당 (도면 파싱 X)
src/emit/*                      → 3D 도구 사정만 (도면값 X)
```

**위반하면**: 두 번째 도면(다른 가시설)을 할 때 파이프라인이 아니라 복사본이 생긴다.

### 📊 검증 체크리스트 (필수)

#### 도면 검증
- [ ] 기준점이 도면 치수 2개 이상과 일치
- [ ] 뷰 폭·높이가 도면 표기와 ±2% 이내
- [ ] 폐곡선 수가 예상과 일치
- [ ] 자기교차 링 없음 (`--loops` 확인)

#### 3D 모델 검증
- [ ] 부피 오차 < 0.5% (IR vs 실제)
- [ ] manifold 체크 (닫힌 면)
- [ ] 렌더링 성공 (Three.js)
- [ ] 부재 정보 표시 가능

#### 배포 검증
- [ ] 웹앱 로딩 < 3초
- [ ] 3D 렌더링 60fps
- [ ] 모바일 반응형 확인
- [ ] 도메인 접속 가능

---

## 에이전트 역할 (단계 5에서 상세 정의)

| 에이전트 | 담당 영역 | 도구 |
|---------|---------|------|
| **Research** | 가시설 도면 분석, 설정 파일 작성 | DXF 파싱, 기하학 분석 |
| **Pipeline** | dwg2model 통합, 테스트 자동화 | 빌드, 검증, 측정 |
| **WebUI** | React 컴포넌트, Three.js 통합 | 개발 서버, 빌드 |
| **Deploy** | CI/CD, Vercel 배포, 도메인 설정 | GitHub Actions, npm |

---

## 빠른 참조

### 자주 실행하는 명령

```bash
# 도면 검증 (Node.js 필요)
node src/run.mjs 가시설

# 3D 생성 (Python & egm CLI 필요)
python src/run_egm.py 가시설 --export=out/gasiseol.obj

# 부피 측정
node src/measure.mjs 가시설 --ir

# 웹앱 개발 서버 (나중)
cd src/web && npm run dev

# 배포 (CI/CD 자동)
git push
```

### 주요 문서 (필독)

| 문서 | 언제 읽을까 |
|------|-----------|
| [`docs/2d-3d-conversion.md`](docs/2d-3d-conversion.md) | **새 도면 추가 전 필수** (19개 함정) |
| [`docs/2d-3d-process.md`](docs/2d-3d-process.md) | 절차 확인 시 |
| [`docs/roadmap.md`](docs/roadmap.md) | 우선순위 확인 시 |
| [`CONSIDERATIONS.md`](CONSIDERATIONS.md) | 고려사항 확인 시 |
| [`PLAN.md`](PLAN.md) | 에이전트 분담 시 |
| [`PROGRESS.md`](PROGRESS.md) | 진행 상황 업데이트 시 |

---

## 품질 기준

### 코드 스타일
```
- 주석은 "왜"를 적는다. "무엇"은 코드가 말한다.
- 조용히 틀리느니 예외를 던진다
- 좌표·치수는 mm 정수로 (egm에 넘기기 전에만 m로 변환)
- 가정하지 마라. 검증하고 단정해라
```

### 테스트
```
- 도면 검증: 자동화 (--loops, --ir, measure.mjs)
- 웹앱: 단위 테스트 + E2E 테스트
- 배포: 리뷰 URL에서 수동 테스트 후 병합
```

### 문서
```
- 코드와 문서를 따로 유지 (업데이트가 다르다)
- 변경사항은 PROGRESS.md에 즉시 기록
- 함정/해결책은 이 파일에 추가
```

---

## 트러블슈팅

### "도면 로드가 실패했어요"
→ `docs/2d-3d-conversion.md` 교훈 #1~#6 확인

### "폐곡선이 4개가 아니에요"
→ `docs/2d-3d-conversion.md` 교훈 #12, #18 (자기교차 검사)

### "부피가 IR과 맞지 않아요"
→ `src/measure.mjs --ir` 로 의도(IR) vs 결과(모델러) 분리

### "웹앱이 느려요"
→ 모델 정점 수 확인, LOD 적용, 번들 최적화

### "배포 실패"
→ GitHub Actions 로그 확인, 환경 변수 설정 검사

---

## 변경 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| 1.0 | 2026-10-16 | 초안 작성 (단계 3) |

---

---

## 🏗️ 하네스 설계 아키텍처 (단계 7)

### 핵심 원칙

Anthropic의 "harness-design-long-running-apps" 설계를 적용:

#### 1. Tractable Chunks (관리 가능한 단위)
```
복잡한 작업 분해 → 각 에이전트가 한 가지만 담당

/convert gasiseol
├─ Stage 1: Research (도면 분석)
├─ Stage 2: Pipeline (3D 생성)
├─ Stage 3: WebUI (앱 개발, 병렬)
└─ Stage 4: Summary (병합 & 검증)
```

#### 2. Structured Artifacts (파일 기반 핸드오프)
```
에이전트 간 통신 = JSON/JS 파일 (스키마 명시)

Research 생성   →  src/drawings/gasiseol.mjs
Pipeline 생성   →  out/gasiseol.obj
Validation      →  baselines/gasiseol.volumes.json

각 파일 = 명확한 계약 → 에이전트가 신뢰할 수 있음
```

#### 3. 체크포인트 기반 복구
```
각 에이전트 완료 후: .claude/artifacts/ 에 스냅샷 저장
실패 시: 마지막 성공 지점에서 재개

예: Pipeline 실패 → Research 결과는 유지 → Pipeline만 재실행
```

#### 4. 3-에이전트 검증
```
Generator (생성)    ← Research, Pipeline, WebUI
Evaluator (검증)    ← /validate 커맨드
Reporter (보고)     ← PROGRESS.md, /report
```

### 에이전트 의존성

```
    DXF 파일
        ↓
    [Research]  ← 기준점 검출, 설정 파일 생성
        ↓
   gasiseol.mjs
        ↓
    [Pipeline]  ← 3D 생성, 부피 검증
        ↓       
    gasiseol.obj
        ↓
   [WebUI] (병렬 가능)  ← 웹앱 개발
    [Deploy]           ← CI/CD 배포
```

**병렬**: Research ↔ WebUI (독립적)
**순차**: Research → Pipeline → Deploy

### 상태 관리

```
PROGRESS.md
  ├─ 현재 단계
  ├─ 완료된 작업
  ├─ 진행 중인 작업
  └─ 다음 예정

.claude/artifacts/
  ├─ gasiseol-checkpoint-1.json (Research 완료)
  ├─ gasiseol-checkpoint-2.json (Pipeline 완료)
  └─ debug-*.log (오류 시)

baselines/
  └─ gasiseol.volumes.json (기준값, 회귀 테스트)
```

### 오류 복구 절차

```
1️⃣ 오류 감지
   /validate 실패 → 어느 에이전트 문제?

2️⃣ 원인 파악
   - 기하학 오류 → Research 재실행
   - Boolean 오류 → Pipeline 재실행
   - 렌더링 오류 → WebUI 재실행

3️⃣ 해당 에이전트만 재개
   마지막 체크포인트에서 시작
   이전 단계의 파일은 유지

4️⃣ 재검증
   /validate --level=full

5️⃣ 진행 상황 업데이트
   PROGRESS.md 수정
```

### 품질 계층 (다층 방어)

```
Layer 1: 파일 존재 확인
         └─ 각 에이전트 출력 파일 존재?

Layer 2: 스키마 검증
         └─ JSON/JS 구조 올바름?

Layer 3: 기능 검증
         └─ 기하학? 부피? 렌더링?

Layer 4: 회귀 검증
         └─ 기준값과 비교 (오차 < 0.5%)
```

---

## 라이선스

이 프로젝트는 [`docs/dwg2model-CLAUDE.md`](docs/dwg2model-CLAUDE.md)를 상속받는다.  
특히 `vendor/acadrust-dwg/` 의 **MPL-2.0** 라이선스를 준수해야 한다.

