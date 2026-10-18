# Mock Testing & 예상 결과물

> DXF→3D 변환의 예상 결과를 미리 정의하고 검증

**작성일**: 2026-10-19  
**목적**: 실제 배포 전에 변환 결과가 타당한지 확인  
**방법**: 단계별 커맨드 실행 + 결과 검증

---

## 🎯 테스트 목표

```
입력:   RAG/가시설_*.dxf (7개 파일, 약 5MB)
처리:   DXF → 뷰 분리 → 폐곡선 → IR → 3D 모델
출력:   out/gasiseol.obj (3D 웹 렌더링용)
검증:   부피 오차 < 0.5%, 기하학 타당성
```

---

## 📊 예상 결과 (시뮬레이션)

### 1단계: 파일 검증

**명령**:
```bash
node src/run.mjs gasiseol
```

**예상 출력**:
```
[gasiseol] 도면 검증 시작...
├─ 파일: RAG/가시설_평면.dxf
├─ 크기: 1.2 MB ✅
├─ DXF 버전: AC1027 (2013+) ✅
├─ 엔티티: 847개
├─ 레이어: 12개
│  ├─ "COLUMN" (기둥)
│  ├─ "BEAM" (보)
│  ├─ "SAFETY" (안전장치)
│  └─ ...
│
├─ 기준점 감지
│  ├─ X축 기준선: x=0
│  ├─ Y축 기준선: y=0
│  └─ 원점: (0, 0)
│
├─ 좌표 범위
│  ├─ X: 0 ~ 50000 mm (폭: 50m) ✅
│  ├─ Y: 0 ~ 30000 mm (길이: 30m) ✅
│  └─ 예상 표기: ~50m × ~30m 일치 ✅
│
└─ 결과: PASS ✅ (기준점 2개 이상 일치)

실행 시간: ~2초
```

### 2단계: 뷰 분리

**명령**:
```bash
node src/gaps.mjs gasiseol
```

**예상 출력**:
```
[gasiseol] 뷰 분리 & 끊김 분석...

평면도 (Plan):
├─ 폭: 50000 mm ✅
├─ 높이: 30000 mm ✅
├─ 엔티티: 342개
├─ 끊김: 0 ✅
└─ 폐곡선 예상: 4개

종단면 (Longitudinal):
├─ 폭: 50000 mm ✅
├─ 높이: 15000 mm ✅
├─ 엔티티: 205개
├─ 끊김: 0 ✅
└─ 폐곡선 예상: 8개

횡단면 A-A (Cross Section):
├─ 폭: 30000 mm ✅
├─ 높이: 15000 mm ✅
├─ 엔티티: 156개
├─ 끊김: 0 ✅
└─ 폐곡선 예상: 4개

횡단면 B-B (Cross Section):
├─ 폭: 30000 mm ✅
├─ 엔티티: 148개
├─ 끊김: 0 ✅
└─ 폐곡선 예상: 4개

상세도 (Detail):
├─ 엔티티: 100개
├─ 끊김: 0 ✅
└─ 폐곡선 예상: 6개

합계: 26개 폐곡선 예상 ✅

실행 시간: ~3초
```

### 3단계: 폐곡선 검증

**명령**:
```bash
node src/build.mjs gasiseol --loops
```

**예상 출력**:
```
[gasiseol] 폐곡선 추출 & 검증...

평면도:
├─ 루프 1: 사각형 (4개 꼭짓점) — 기둥 단면
├─ 루프 2: 사각형 (4개 꼭짓점) — 보 단면
├─ 루프 3: 직사각형 (4개 꼭짓점) — 기초
└─ 루프 4: 복합 도형 (8개 꼭짓점) — 안전장치

검증:
✅ 루프 1: 닫혀있음, 자기교차 없음
✅ 루프 2: 닫혀있음, 자기교차 없음
✅ 루프 3: 닫혀있음, 자기교차 없음
✅ 루프 4: 닫혀있음, 자기교차 없음

종단면: 8개 루프 ✅
횡단면 A: 4개 루프 ✅
횡단면 B: 4개 루프 ✅
상세도: 6개 루프 ✅

합계: 26개 루프 모두 PASS ✅

실행 시간: ~5초
```

### 4단계: IR 생성

**명령**:
```bash
node src/build.mjs gasiseol
```

**예상 출력**:
```
[gasiseol] IR (중간 표현) 생성...

프로파일 변환:
├─ 평면도 → XY 평면 좌표
│  ├─ 기둥: 1개 (50mm × 50mm 단면)
│  ├─ 보: 2개 (50mm × 30mm 단면)
│  └─ 기초: 1개 (200mm × 200mm 단면)
│
├─ 종단면 → XZ 평면 좌표 (높이 정보)
│  ├─ 높이 범위: -1000mm ~ 15000mm
│  └─ 주요 높이: 0(기초), 5000(상부), 15000(난간)
│
├─ 횡단면 → 형태 검증
│  ├─ 폭 정보: 30000mm 일정
│  └─ 변화도: 직선 (extrude 가능)
│
└─ 조립 지시:
   ├─ 기둥: extrude 50×50 × 16000mm
   ├─ 보: loft 50×30 단면 (길이 50m)
   ├─ 기초: extrude 200×200 × 1000mm
   └─ 안전장치: union (기둥과 연결)

파일 생성:
├─ out/gasiseol.ir.json (123KB) ✅
│  └─ 검증: JSON 구문 정확
│
└─ PROGRESS.md 업데이트

실행 시간: ~8초
```

### 5단계: 3D 모델 생성 (EGModeler)

**명령**:
```bash
python src/run_egm.py gasiseol --export=out/gasiseol.obj
```

**예상 출력**:
```
[egm] EGModeler 3D 생성 시작...

IR 로드: out/gasiseol.ir.json ✅

명령 생성:
├─ extrude [기둥]: 50×50×16000
├─ extrude [보]: 50×30×50000
├─ extrude [기초]: 200×200×1000
├─ union [기둥-안전장치]
└─ union [전체]

모델 생성:
├─ 기둥 1: 정점 8개 → 면 12개 → 4800 mm³
├─ 기둥 2: 정점 8개 → 면 12개 → 4800 mm³
├─ 보 1: 정점 8개 → 면 12개 → 75000 mm³
├─ 보 2: 정점 8개 → 면 12개 → 45000 mm³
├─ 기초: 정점 8개 → 면 12개 → 40000 mm³
└─ 안전장치: 정점 12개 → 면 18개 → 12000 mm³

모델 검증:
├─ Manifold 체크: ✅ (모든 모서리 공유)
├─ 닫힌 면: ✅ (누수 없음)
├─ 정점: 52개
├─ 면: 78개
└─ 정점 중복 제거: 완료

파일 생성:
├─ out/gasiseol.obj (2.3 MB)
│  ├─ 면 데이터: 78개
│  ├─ 정점 수: 52개
│  └─ 검증: OBJ 형식 정확 ✅
│
└─ 렌더링 테스트
   ├─ Three.js 로드: ✅
   ├─ 메모리: ~45MB
   └─ 초기 렌더링: 200ms

실행 시간: ~3분

최종 결과:
✅ 3D 모델 완성 (닫힌 면, 검증됨)
✅ 웹 렌더링 준비 완료
```

### 6단계: 부피 검증

**명령**:
```bash
node src/measure.mjs gasiseol --ir     # IR 기준 부피
node src/measure.mjs gasiseol          # 모델 측정 부피
```

**예상 출력**:
```
[measure] IR 기준 부피 (의도)...

부재별 부피:
├─ 기둥 1 (50×50×16000): 40 m³
├─ 기둥 2 (50×50×16000): 40 m³
├─ 보 1 (50×30×50000): 75 m³
├─ 보 2 (50×30×45000): 67.5 m³
├─ 기초 (200×200×1000): 40 m³
└─ 안전장치 (추정): 12 m³

전체 IR 부피: 274.5 m³

---

[measure] 모델 측정 부피 (결과)...

Mesh 해석:
├─ 정점: 52개
├─ 면: 78개
├─ 부피 계산: 적분법 (Divergence Theorem)

부재별 측정:
├─ 기둥 1: 39.98 m³
├─ 기둥 2: 40.02 m³
├─ 보 1: 74.95 m³
├─ 보 2: 67.48 m³
├─ 기초: 40.01 m³
└─ 안전장치: 12.03 m³

전체 모델 부피: 274.47 m³

---

[validation] 검증...

부피 비교:
├─ IR 부피: 274.50 m³
├─ 모델 부피: 274.47 m³
├─ 차이: 0.03 m³
├─ 오차율: 0.011% ✅
└─ 기준 (< 0.5%): PASS ✅

기준값 저장:
└─ baselines/gasiseol.volumes.json
   {
     "timestamp": "2026-10-19T12:34:56Z",
     "irVolume": 274.50,
     "realVolume": 274.47,
     "errorPercent": 0.011,
     "status": "PASS",
     "parts": {
       "column_1": { "ir": 40, "real": 39.98, "error": 0.005 },
       "column_2": { "ir": 40, "real": 40.02, "error": 0.005 },
       "beam_1": { "ir": 75, "real": 74.95, "error": 0.007 },
       "beam_2": { "ir": 67.5, "real": 67.48, "error": 0.003 },
       "foundation": { "ir": 40, "real": 40.01, "error": 0.002 },
       "safety": { "ir": 12, "real": 12.03, "error": 0.025 }
     }
   }

실행 시간: ~4초
```

---

## ✅ 최종 검증

**명령**:
```bash
/validate --level=full
```

**예상 출력**:
```
[validate] 4단계 검증 시작...

Layer 1: 파일 존재
├─ out/gasiseol.obj ✅
├─ out/gasiseol.ir.json ✅
└─ baselines/gasiseol.volumes.json ✅

Layer 2: 스키마 검증
├─ OBJ 형식: ✅
├─ JSON 구조: ✅
└─ 필드 완성: ✅

Layer 3: 기능 검증
├─ 부피 오차 < 0.5%: ✅ (0.011%)
├─ Manifold 체크: ✅
├─ 정점 정상성: ✅
└─ 면 방향성: ✅

Layer 4: 회귀 검증
├─ 기준값과 비교: ✅ (정확히 일치)
├─ 과거 버전과 호환: ✅
└─ 성능 저하 없음: ✅

최종 결과: PASS ✅

소요 시간: 총 7분 50초
```

---

## 📋 전체 파일 목록 (변환 후)

```
out/
├── gasiseol.obj
│   ├─ 크기: 2.3 MB
│   ├─ 형식: Wavefront OBJ (텍스트)
│   ├─ 면: 78개
│   ├─ 정점: 52개
│   └─ 정점/면 비율: 2.3 (정상 = 2~3)
│
├── gasiseol.ir.json
│   ├─ 크기: 123 KB
│   ├─ 레벨: IR (중간 표현, 도면 독립)
│   └─ 내용: 프로파일 + 조립 지시
│
└── gasiseol-validation.json
    ├─ 크기: 12 KB
    ├─ 내용: 부피, 검증 결과
    └─ 생성: 단계 5 후

baselines/
└── gasiseol.volumes.json
    ├─ 크기: 5 KB
    ├─ 목적: 회귀 테스트
    └─ 업데이트: 매 성공 후
```

---

## 🚨 문제 시나리오

### 시나리오 1: 부피 오차 > 0.5%

**증상**:
```
모델 부피: 270.0 m³
IR 부피: 274.5 m³
오차: 1.64% ❌
```

**원인 추적**:
1. `node src/measure.mjs gasiseol --ir --verbose` (IR 재계산)
2. `egm status` (EGModeler의 Boolean 손실 확인)
3. `cat src/drawings/gasiseol.mjs | grep -A 30 "assemble"` (조립 로직 재검토)

**해결**:
- assemble() 함수에서 union 순서 변경
- Boolean 손실 부분 재조정
- 다시 실행: `node src/build.mjs gasiseol && python src/run_egm.py gasiseol --export=out/gasiseol.obj`

### 시나리오 2: 폐곡선이 닫혀있지 않음

**증상**:
```
루프 3: 자기교차 감지 ❌
루프 4: 끊김 = 2개 ❌
```

**원인 추적**:
1. `node src/build.mjs gasiseol --loops --debug` (상세 분석)
2. `grep "crossing\|gap" out/gasiseol.debug.log` (해당 루프 찾기)
3. DXF 파일 재확인 (도면 손상 여부)

**해결**:
- docs/2d-3d-conversion.md 교훈 #12 적용 (자기교차 제거)
- 또는 교훈 #3 (끊김 수동 연결)
- 필요시 DXF 파일 수정 후 재실행

### 시나리오 3: EGModeler 오류

**증상**:
```
python src/run_egm.py gasiseol --export=out/gasiseol.obj
오류: [egm] Command not found
```

**확인**:
```bash
which egm
# 또는
egm --version
```

**해결**:
- EGModeler 설치 확인
- PATH 환경 변수 확인
- docs/2d-3d-conversion.md 교훈 #15 참고

---

## 📈 성능 기준

```
문제 없을 때 예상 시간:
├─ 파일 검증: 2초 ✅
├─ 뷰 분리: 3초 ✅
├─ 폐곡선 추출: 5초 ✅
├─ IR 생성: 8초 ✅
├─ 3D 생성: 3분 (병목)
├─ 부피 검증: 4초 ✅
└─ 전체: 7분 50초

느려지는 경우:
- 정점 수 > 100,000개 → 렌더링 최적화 필요
- OBJ 파일 > 10MB → 압축 필요
```

---

## 🎯 테스트 완료 기준

```
✅ 모든 단계 오류 없음
✅ 부피 오차 < 0.5%
✅ OBJ 파일 생성됨 (크기 > 0)
✅ Three.js에서 로드 가능
✅ 부재 정보 추출 가능
✅ 기준값 저장 완료

→ 웹 배포 준비 완료!
```

---

## 📝 테스트 체크리스트

```
□ Step 1: node src/run.mjs gasiseol
□ Step 2: node src/gaps.mjs gasiseol
□ Step 3: node src/build.mjs gasiseol --loops
□ Step 4: node src/build.mjs gasiseol
□ Step 5: python src/run_egm.py gasiseol --export=out/gasiseol.obj
□ Step 6a: node src/measure.mjs gasiseol --ir
□ Step 6b: node src/measure.mjs gasiseol
□ Step 7: /validate --level=full

모두 ✅ → 웹 배포 진행!
```

