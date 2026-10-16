# 단계 5: 에이전트/커맨드/스킬/훅 아이디어 상세 제안

> 이 문서는 Claude Code의 에이전트, 커맨드, 스킬, 훅을 설계하기 위한 아이디어를 상세히 정리한 것입니다.
> 단계 6에서 정확한 포맷으로 구현될 밑그림입니다.

---

## 📊 전체 구조도

```
사용자
  ↓
커맨드 입력
  ├─ /step-X
  ├─ /convert (병렬)
  ├─ /validate
  ├─ /deploy
  └─ /report
  ↓
Orchestrator (조율)
  ├─ 병렬/순차 작업 관리
  ├─ 체크포인트 저장
  └─ 오류 복구
  ↓
4개 에이전트 (병렬 실행)
  ├─ Agent-Research (DXF 분석)
  ├─ Agent-Pipeline (3D 생성)
  ├─ Agent-WebUI (웹앱)
  └─ Agent-Deploy (배포)
  ↓
스킬 & 훅 (자동화)
  ├─ /dxf-analyze
  ├─ /3d-validate
  ├─ /web-dev
  └─ [자동 훅들]
```

---

## 🤖 에이전트 상세 정의

### 1️⃣ Agent-Research: DXF 도면 분석 & 설정 파일 생성

#### 기본 정보
```
이름: Research
설명: 2D DXF 도면을 분석하여 3D 변환을 위한 설정 파일 생성
역할: 파이프라인의 시작 단계
입력: DXF 파일 (RAG 폴더)
출력: src/drawings/gasiseol.mjs (설정 파일 + 조립 로직)
```

#### 주요 담당 작업
```
1️⃣ DXF 파일 기본 분석
   - 엔티티 타입별 개수 (LINE, CIRCLE, ARC, TEXT 등)
   - 좌표 범위 (min/max X, Y, Z)
   - 레이어 목록 및 구분
   - 도형 바운딩 박스

2️⃣ 기준점(Datum) 검출
   - 기준선 자동 감지 (도로 계획고, 토공 계획고 등)
   - 텍스트 라벨과 선 대응
   - 기준점 좌표 확정
   - 다른 뷰와 교차검증

3️⃣ 뷰 분리 및 매핑
   - 제목 텍스트로 뷰 식별 (평면도, 단면도 등)
   - 뷰별 기하 클러스터링
   - 뷰 bounding box 계산
   - 앵커(u0, v0, flip, swapUV) 결정

4️⃣ 프로파일 추출
   - 각 뷰의 폐곡선 목록 추출
   - 치수 텍스트와 기하 대응
   - 원/호 감지 및 처리
   - 자기교차 검출 & 경고

5️⃣ 설정 파일 생성
   - src/drawings/gasiseol.mjs 작성
   - 뷰별 설정 (kind, plane, anchors)
   - 조립 로직 (assemble 함수)
   - 재질 매핑 (레이어 → 재질)
```

#### 사용할 도구 & 기술
```
도구:
  - Read: DXF 파일 읽기
  - Grep: 특정 패턴 검색
  - Bash: Node.js 스크립트 실행
  - Edit: 설정 파일 작성

기술:
  - DXF 파싱 (기존 src/core/parse.mjs)
  - 기하학 계산 (좌표 변환)
  - 정규식 (텍스트 분석)
  - 데이터 구조화 (JSON/JS 객체)
```

#### 성공 기준
```
✅ DXF 로드 성공
✅ 기준점이 도면 치수 2개 이상과 일치
✅ 뷰 폭·높이가 도면 표기와 ±2% 이내
✅ 폐곡선 4개(평면), 8개(단면) 등 예상과 일치
✅ 자기교차 없음
✅ src/drawings/gasiseol.mjs 생성 완료
```

#### 입출력 예시
```
입력:
  RAG/가시설_평면.dxf
  RAG/가시설_단면.dxf
  RAG/가시설_상세1~4.dxf

출력:
  src/drawings/gasiseol.mjs
  {
    drawings: {
      gasiseol: {
        dwgPath: 'RAG/가시설_평면.dxf',
        unitMm: 1000,  // 1 DWG unit = 1000mm
        titles: {
          views: [
            { kind: 'plan', name: '평 면 도', title_h: 0.35 },
            { kind: 'cross', name: '단 면 A-A', title_h: 0.35 },
            ...
          ]
        },
        anchors: {
          '평 면 도': { u0: 0, v0: 0, plane: 'XY' },
          '단 면 A-A': { u0: 0, v0: -5000, plane: 'XZ' },
          ...
        },
        assemble: function(ir) { ... }  // 부재 조립 로직
      }
    }
  }
```

---

### 2️⃣ Agent-Pipeline: 3D 생성 & 검증

#### 기본 정보
```
이름: Pipeline
설명: DXF 설정을 이용해 IR 생성, 3D 모델 생성, 검증
역할: 핵심 변환 파이프라인
의존: Agent-Research 완료 필수
입력: src/drawings/gasiseol.mjs
출력: out/gasiseol.obj, out/gasiseol.ifc, volumes.json
```

#### 주요 담당 작업
```
1️⃣ IR (중간 표현) 생성
   - 폐곡선 → 프로파일
   - 프로파일 → 3D 부재 (extrude, loft 등)
   - 부재 조합 (union, difference)
   - 최종 형상 구성

2️⃣ 검증 (자동화)
   - 폐곡선 폐쇄성 검사
   - 기하학 타당성 확인
   - 부피 계산 (IR 기준)
   - 기준값과 비교 (±0.5%)

3️⃣ 3D 모델 생성
   - EGModeler 명령 생성
   - Polyline, Extrude, Loft, Boolean 등
   - 모델 조립 및 순서 관리
   - 부피 측정 (실제 모델)

4️⃣ 검증 완료
   - IR 부피 vs 실제 모델 부피 비교
   - 이상 감지 및 보고
   - 기준값 저장 (baselines/)

5️⃣ 출력 생성
   - OBJ 파일 (웹 렌더링)
   - IFC 파일 (BIM 표준)
   - 검증 리포트
```

#### 사용할 도구 & 기술
```
도구:
  - Bash: Node.js 스크립트 실행
  - Read: 설정 파일 읽기
  - Write: 검증 리포트 작성

기술:
  - src/build.mjs (IR 생성)
  - src/run_egm.py (3D 생성)
  - src/measure.mjs (부피 측정)
  - 기준값 관리 (baselines/)
```

#### 성공 기준
```
✅ IR 생성 성공
✅ 기하학 검증 통과 (폐곡선 닫힘)
✅ 부피 오차 < 0.5% (IR vs 실제)
✅ 3D 모델 생성 성공
✅ OBJ, IFC 파일 생성
✅ 검증 리포트 완성
```

#### 입출력 예시
```
입력:
  src/drawings/gasiseol.mjs

중간 과정:
  out/gasiseol.ir.json  (IR 중간 표현)
  
출력:
  out/gasiseol.obj      (3D 모델 - 웹용)
  out/gasiseol.ifc      (IFC - BIM용)
  baselines/gasiseol.volumes.json
  {
    "irVolume": 245.823,    // IR 기준 부피
    "realVolume": 245.756,  // 모델러에서 측정한 부피
    "error": 0.027,         // 오차 (%)
    "status": "PASS",       // 검증 결과
    "timestamp": "2026-10-16T14:30:00Z"
  }
```

---

### 3️⃣ Agent-WebUI: 웹앱 & 3D 뷰어

#### 기본 정보
```
이름: WebUI
설명: React 웹앱 + Three.js 3D 뷰어 개발
역할: 사용자 인터페이스
병렬: Agent-Research와 동시 진행 가능
입력: 3D 모델 (OBJ 파일), UI 요구사항
출력: src/web/ (React 프로젝트)
```

#### 주요 담당 작업
```
1️⃣ 프로젝트 구조 생성
   - React + Vite + TypeScript 보일러플레이트
   - 폴더 구조 (components, pages, styles, utils)
   - ESLint, Prettier 설정
   - 의존성 설치

2️⃣ UI 컴포넌트 개발
   - FileUpload: DXF 파일 선택 및 업로드
   - Viewer3D: Three.js 기반 3D 렌더링
   - PropertyPanel: 부재 정보 표시
   - Controls: 뷰 전환, 줌, 회전 조작
   - StatusBar: 변환 진행률

3️⃣ Three.js 통합
   - OBJ 로더 (models/gasiseol.obj)
   - 카메라 설정 (자동 줌)
   - 라이팅 (기본 조명)
   - 그리드 & 축 표시
   - 마우스 조작 (OrbitControls)

4️⃣ 상호작용 구현
   - 부재 선택 (클릭) → 정보 표시
   - 부재 하이라이트 (색상 변경)
   - 레이어별 필터링
   - 단면 표시 (slicing)
   - 측정 기능 (거리, 면적)

5️⃣ 배포 최적화
   - 번들 최소화 (Tree shaking)
   - 이미지 압축
   - 지연 로딩 (3D 모델)
   - 성능 모니터링
```

#### 사용할 도구 & 기술
```
도구:
  - Edit: 코드 작성
  - Write: 설정 파일 생성
  - Bash: npm 명령 실행

기술:
  - React 18+
  - Vite (번들러)
  - Three.js + react-three-fiber
  - TypeScript
  - TailwindCSS (스타일)
  - Zustand (상태 관리)
```

#### 성능 목표
```
✅ 초기 로딩: < 3초
✅ 3D 렌더링: 60fps 유지
✅ 번들 크기: < 500KB (압축)
✅ 모바일 지원: 반응형 + 터치 제스처
```

#### 주요 페이지/컴포넌트
```
src/web/
├── pages/
│   ├── index.tsx           메인 페이지 (업로드 + 뷰어)
│   └── api/convert.ts      백엔드 API (DXF → 3D)
│
├── components/
│   ├── Viewer3D.tsx        Three.js 뷰어
│   ├── FileUpload.tsx      파일 업로드
│   ├── PropertyPanel.tsx   부재 정보
│   ├── Controls.tsx        UI 컨트롤
│   └── StatusBar.tsx       진행 상황
│
├── hooks/
│   ├── useThreeJS.ts       Three.js 초기화
│   ├── useModel.ts         모델 로드/관리
│   └── useSelection.ts     부재 선택 상태
│
└── styles/
    └── globals.css         전역 스타일
```

---

### 4️⃣ Agent-Deploy: CI/CD & 배포

#### 기본 정보
```
이름: Deploy
설명: GitHub Actions CI/CD, Vercel 배포, 무료 도메인 설정
역할: 자동화된 배포 파이프라인
의존: Agent-WebUI, Agent-Pipeline 완료 후
입력: 웹앱 소스 코드, git 푸시
출력: 배포된 웹사이트 (URL 제공)
```

#### 주요 담당 작업
```
1️⃣ GitHub Actions 워크플로우 설정
   - 린트 & 포맷 체크 (ESLint, Prettier)
   - 타입 체크 (TypeScript)
   - 단위 테스트 실행
   - 빌드 테스트
   - 도면 검증 (node src/build.mjs --validate)

2️⃣ Vercel 배포 설정
   - Vercel 프로젝트 생성
   - 환경 변수 설정
   - 빌드 커맨드 구성 (npm run build)
   - 프리뷰 URL 자동 생성

3️⃣ 무료 도메인 설정
   - Freenom에서 도메인 등록 (.tk/.ml/.ga 등)
   - DNS 레코드 구성 (CNAME → Vercel)
   - SSL 인증서 (Vercel 자동)

4️⃣ 모니터링 & 알림
   - 배포 성공/실패 알림
   - 성능 모니터링 (Core Web Vitals)
   - 오류 로깅 (Sentry 선택사항)

5️⃣ 배포 문서 작성
   - 배포 절차 가이드
   - 롤백 방법
   - 환경 변수 관리
```

#### 사용할 도구 & 기술
```
도구:
  - Write: 워크플로우 파일 작성 (.github/workflows/)
  - Bash: CLI 커맨드 실행

기술:
  - GitHub Actions (CI/CD)
  - Vercel CLI
  - npm 스크립트
  - 환경 변수 (.env)
```

#### 워크플로우 예시
```
.github/workflows/ci-cd.yml

name: CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run type-check
      
      - name: Test
        run: npm run test
      
      - name: Build
        run: npm run build
      
      - name: Validate DXF
        run: node src/build.mjs gasiseol --validate

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

#### 배포 성공 기준
```
✅ 모든 테스트 통과
✅ Vercel 배포 성공
✅ 도메인 연결 확인
✅ 웹사이트 접속 가능
✅ 3D 모델 렌더링 확인
```

---

## 🎯 커맨드 상세 정의

### 커맨드 1: /step-X (단계별 워크플로우)

```yaml
이름: step
트리거: /step-1, /step-2, ..., /step-9
설명: 현재 단계의 완전한 워크플로우 실행

작동 방식:
  1. PLAN.md에서 현재 단계 내용 읽기
  2. 작업 리마인드 (이 단계에서 할 것)
  3. 에이전트 호출
  4. 결과 검증
  5. 다음 단계 예고

예시:
  /step-4
  → PROGRESS.md 읽기
  → PLAN.md 단계 4 확인
  → Agent-Research + Agent-Pipeline 병렬 실행
  → 검증 실행
  → PROGRESS.md 업데이트
```

### 커맨드 2: /convert (통합 변환)

```yaml
이름: convert
트리거: /convert <DXF파일명>
설명: DXF → 3D 전체 파이프라인 (병렬 처리)

작동 방식 (병렬):
  Stage 1: Agent-Research (DXF 분석)
           ├─ 도면 분석
           ├─ 기준점 검출
           └─ 설정 파일 생성
           
  Stage 2: Agent-Pipeline (3D 생성)
           ├─ IR 생성
           ├─ 3D 모델 생성
           └─ 검증
           
  Stage 3: Agent-WebUI (웹앱 준비)
           ├─ 모델 로드
           ├─ 3D 뷰어 업데이트
           └─ 배포 준비
           
  Stage 4: 병합 (모든 완료 대기)
           ├─ 최종 검증
           └─ 결과 리포트

예시:
  /convert 가시설
  
  실행:
    [Stage 1] Research...  (진행 중)
    [Stage 2] Pipeline...  (대기 중)
    [Stage 3] WebUI...     (병렬)
    
  완료:
    ✅ 설정 파일: src/drawings/gasiseol.mjs
    ✅ 3D 모델: out/gasiseol.obj
    ✅ 검증 리포트: baselines/gasiseol.volumes.json
    ✅ 웹앱 업데이트 완료
```

### 커맨드 3: /validate (검증)

```yaml
이름: validate
트리거: /validate [<도면명>]
설명: 도면 & 3D 모델 자동 검증

검증 항목:
  Level 1: 기본 파싱
    ✓ DXF 로드 성공
    ✓ 엔티티 수 > 0
    ✓ 기준점 감지
    
  Level 2: 기하학
    ✓ 뷰 폭/높이 ±2% 이내
    ✓ 폐곡선 수 일치
    ✓ 자기교차 없음
    
  Level 3: 3D
    ✓ 부피 오차 < 0.5%
    ✓ manifold 체크
    ✓ 면 무결성
    
  Level 4: 시각화
    ✓ 웹 렌더링 성공
    ✓ 부재 정보 표시
    ✓ 조작 가능

출력:
  ✅ 검증 통과 (모든 항목 초록색)
  ⚠️ 경고 (일부 항목 노랑색)
  ❌ 검증 실패 (빨간색 표시)
```

### 커맨드 4: /deploy (배포)

```yaml
이름: deploy
트리거: /deploy [--dry-run]
설명: 웹앱을 Vercel에 배포

작동:
  1. 모든 테스트 실행 (/validate)
  2. 빌드 생성 (npm run build)
  3. Vercel에 배포 (vercel deploy)
  4. 도메인 연결 확인
  5. 최종 URL 제공

옵션:
  --dry-run: 실제 배포 없이 확인만
  --preview: 프리뷰 URL 생성 (CI/CD)
  --prod: 프로덕션 배포

출력:
  🌐 배포 완료!
  URL: https://dxf-to-3d.tk
  Preview: https://dxf-to-3d-preview-12345.vercel.app
```

### 커맨드 5: /report (리포트)

```yaml
이름: report
트리거: /report [--format=md|html|json]
설명: 진행 상황 & 검증 결과 리포트

포함 내용:
  ✅ 완료된 단계
  🔄 진행 중인 단계
  ⏳ 예정 단계
  
  도면 검증 현황
  3D 모델 부피
  배포 상태
  성능 지표
  
  다음 단계 로드맵

형식:
  --format=md: Markdown (기본)
  --format=html: HTML 리포트
  --format=json: JSON 데이터
```

---

## 🎨 스킬 상세 정의

### 스킬 1: /dxf-analyze

```yaml
이름: dxf-analyze
트리거: /dxf-analyze <DXF파일>
설명: DXF 파일 상세 분석

기능:
  1. 기본 정보
     - 파일 크기
     - 엔티티 총 개수
     - DWG 버전
     
  2. 좌표 분석
     - 범위 (min/max X, Y, Z)
     - 중심점
     - 스케일
     
  3. 도형 분석
     - LINE: 개수, 길이 통계
     - CIRCLE: 개수, 반지름 통계
     - ARC: 개수
     - POLYLINE: 개수, 닫힘 여부
     
  4. 레이어 분석
     - 레이어 목록
     - 레이어별 도형 수
     - 색상 분포
     
  5. 텍스트 분석
     - 텍스트 총 개수
     - 높이별 분포
     - 주요 텍스트 추출

출력 형식:
  ```
  DXF 분석: 가시설_평면.dxf
  ═══════════════════
  
  📊 기본 정보
  - 파일 크기: 575 KB
  - 엔티티 수: 2,145개
  - DWG 버전: DWG 2018
  
  📍 좌표 범위
  - X: 0 ~ 50,000 mm
  - Y: -10,000 ~ 40,000 mm
  - Z: -5,000 ~ 0 mm
  
  🔷 도형 분포
  - LINE: 1,234개 (평균 길이 1,500mm)
  - CIRCLE: 45개 (반지름 100~500mm)
  - POLYLINE: 89개 (폐쇄: 78개)
  
  📝 레이어 (상위 5개)
  1. 000-구조물실선: 456개
  2. -전력구: 345개
  3. 1-보조선: 234개
  4. 치수: 178개
  5. 텍스트: 156개
  ```
```

### 스킬 2: /3d-validate

```yaml
이름: 3d-validate
트리거: /3d-validate <OBJ|IFC파일>
설명: 3D 모델 상세 검증

기능:
  1. 기하학 검증
     - 폐면 여부 (manifold)
     - 면 법선 방향 (일관성)
     - 중복 면 검사
     - 자기 교차 검사
     
  2. 부피 검증
     - 계산된 부피
     - 기준값과 비교
     - 오차율 (%)
     - 부위별 부피
     
  3. 정점 분석
     - 총 정점 수
     - 총 면 수
     - 경계 정보 (면 수)
     - 복잡도 평가
     
  4. 성능 분석
     - 렌더링 시간 (추정)
     - 메모리 사용량 (추정)
     - 최적화 제안

출력 형식:
  ```
  3D 모델 검증: gasiseol.obj
  ═══════════════════════════
  
  ✅ 기하학
  - Manifold: YES
  - 법선 일관성: 98.5%
  - 자기교차: 없음
  
  ✅ 부피
  - 계산: 245.823 m³
  - 기준값: 245.756 m³
  - 오차: -0.027% ✓ (< 0.5%)
  
  📊 복잡도
  - 정점: 15,234개
  - 면: 28,567개
  - 경계 면: 0개
  
  ⚡ 성능 (추정)
  - 렌더링 시간: ~45ms (60fps 유지)
  - 메모리: ~180MB (최악의 경우)
  - 최적화: "잘 최적화됨"
  ```
```

### 스킬 3: /web-dev

```yaml
이름: web-dev
트리거: /web-dev [--port=3000]
설명: 웹앱 개발 서버 실행

기능:
  1. 로컬 개발 서버 시작
     - Vite 핫 모듈 교체
     - 실시간 수정 반영
     - 브라우저 자동 새로고침
     
  2. 개발 도구 제공
     - React DevTools
     - 네트워크 탭
     - 콘솔 로그
     
  3. 모델 로드
     - 로컬 3D 모델 (out/)
     - API 엔드포인트 (로컬)
     
  4. 성능 모니터링
     - 번들 크기
     - 로드 시간
     - 프레임 레이트

명령:
  /web-dev              기본 포트 3000
  /web-dev --port=8080 사용자 포트
  /web-dev --build     빌드만 (배포용)
  /web-dev --analyze   번들 분석

출력:
  ```
  🚀 웹앱 개발 서버 시작
  ════════════════════
  
  Local: http://localhost:3000
  
  📦 번들 정보
  - 크기: 245 KB (압축: 78 KB)
  - 파일: 12개
  - 최적화: 우수
  
  🔄 감시 중: src/**/*
  
  💡 팁:
  /web-dev --analyze  번들 시각화
  Ctrl+C             중지
  ```
```

---

## 🔧 훅 자동화 규칙

### 훅 1: Git 커밋 후 자동 검증

```yaml
이름: post-commit-validate
트리거: git commit (모든 커밋)
설명: 도면 파일이 변경되면 자동 검증

규칙:
  1. 커밋된 파일 확인
  2. DXF 또는 설정 파일 변경 감지
  3. 자동 검증 실행 (/validate)
  4. 문제 발생 시:
     - 경고 메시지 출력
     - PROGRESS.md에 자동 기록
     - 필요시 커밋 취소 제안

설정 (settings.json):
  {
    "hooks": {
      "post-commit": {
        "run": "node src/measure.mjs --validate",
        "alert": "always",
        "on_error": "warn"
      }
    }
  }
```

### 훅 2: PROGRESS.md 수정 후 상태 반영

```yaml
이름: progress-update
트리거: PROGRESS.md 수정
설명: 진행 상황 변경을 시스템에 반영

규칙:
  1. PROGRESS.md 변경 감지
  2. 다음 세션 에이전트에 알림
  3. 체크포인트 생성
  4. 깃 태그 자동 생성

설정:
  {
    "hooks": {
      "watch:PROGRESS.md": {
        "run": "git tag -a v$(grep 'Current:' PROGRESS.md) -m 'Progress update'",
        "auto_commit": false
      }
    }
  }
```

### 훅 3: 배포 전 최종 확인

```yaml
이름: pre-deploy-check
트리거: git push --tags (배포 전 신호)
설명: 배포 전 모든 검증 실행

검사 항목:
  1. ESLint 통과
  2. TypeScript 타입 체크 통과
  3. 모든 테스트 통과
  4. DXF 검증 통과
  5. 3D 모델 검증 통과
  6. 번들 크기 < 500KB

실패 시:
  - 배포 중단
  - 에러 메시지 상세 출력
  - 수정 가이드 제시

설정:
  {
    "hooks": {
      "pre-deploy": {
        "scripts": [
          "npm run lint",
          "npm run type-check",
          "npm run test",
          "node src/build.mjs --validate"
        ],
        "on_error": "abort"
      }
    }
  }
```

### 훅 4: 이상 감지 시 자동 알림

```yaml
이름: anomaly-alert
트리거: 지속적 모니터링
설명: 부피 오차, 렌더링 오류 등 감지 시 알림

감지 항목:
  1. 부피 오차 > 1%
  2. 새로운 자기교차 링 발견
  3. 폐곡선 개수 변경
  4. 웹 렌더링 오류
  5. 배포 실패

알림:
  - 콘솔 경고 (빨강/주황)
  - PROGRESS.md 자동 기록
  - 선택사항: 이메일/Slack 알림

설정:
  {
    "hooks": {
      "monitor": {
        "interval": "after:every:commit",
        "checks": [
          "volume_error < 0.5%",
          "self_intersections == 0",
          "web_render_success == true"
        ],
        "alert": "console+log"
      }
    }
  }
```

---

## 📋 구현 체크리스트

### 아이디어 검증
- [ ] 4개 에이전트 설명 검토 ✅
- [ ] 4개 커맨드 스펙 검토 ✅
- [ ] 3개 스킬 기능 검토 ✅
- [ ] 4개 훅 자동화 검토 ✅

### 다음 단계 (단계 6)
- [ ] Claude Code 공식 포맷 학습
- [ ] .claude/ 폴더 구조 생성
- [ ] agents/*.md 파일 작성 (4개)
- [ ] commands/*.yaml 파일 작성 (4개)
- [ ] skills/*.yaml 파일 작성 (3개)
- [ ] settings.json 훅 설정
- [ ] 모든 파일 테스트

---

## 질문 및 검토 포인트

1. **4개 에이전트가 적절한가?**
   - 병렬 처리 가능 여부
   - 의존성 명확성
   - 역할 중복 여부

2. **커맨드 구조가 직관적인가?**
   - /step-X vs /convert
   - 병렬 처리 신호 명확성
   - 오류 처리 방식

3. **스킬의 자동화 수준이 적절한가?**
   - 사용자 개입 필요 여부
   - 결과물 형식
   - 재활용성

4. **훅이 과하지 않은가?**
   - 자동화 vs 통제의 균형
   - 거짓 양성(오경고) 위험
   - 사용자 불편 정도

---

## 변경 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| 1.0 | 2026-10-16 | 초안 작성 (단계 5) |

