# 실행 가이드 — DXF to 3D 실제 변환

> 가시설 DXF 파일을 3D 모델로 변환하는 **전체 절차**

**작성일**: 2026-10-19  
**대상 파일**: RAG/가시설_*.dxf (7개 파일)  
**예상 시간**: 20~30분

---

## 🚀 빠른 시작

```bash
# 1. 의존성 설치
cd D:\Obsidian Vault\999ETC\261016_HW_DwfTo3D
npm install

# 2. 도면 검증 (단계 1)
node src/run.mjs gasiseol

# 3. 뷰 분리 & 폐곡선 추출 (단계 2)
node src/gaps.mjs gasiseol

# 4. 폐곡선 검증 (단계 2-3)
node src/build.mjs gasiseol --loops

# 5. IR 생성 (단계 4)
node src/build.mjs gasiseol

# 6. 3D 생성 (단계 5-6)
python src/run_egm.py gasiseol --export=out/gasiseol.obj

# 7. 부피 검증 (단계 8)
node src/measure.mjs gasiseol --ir

# 8. 모델 검증
node src/measure.mjs gasiseol
```

---

## 📋 단계별 상세 절차

### 단계 0: 환경 확인

```bash
# Node.js 버전 확인
node --version
# → v18.0.0 이상 필요

# Python 확인
python --version
# → 3.8+ 필요

# EGModeler 상태 확인
egm guide | wc -l
# → 39 = 뷰어 모드 (오류!)
# → 200+ = 정상
```

**문제 시**: `docs/2d-3d-conversion.md` 교훈 #15 참고

---

### 단계 1: DXF 파일 검증

```bash
node src/run.mjs gasiseol
```

**확인 항목**:
```
✓ 파일 로드 성공
✓ 기준점 감지
✓ 뷰 폭/높이 도면 표기와 ±2% 일치
✓ 좌표 범위 타당
```

**실패 시**:
- 기준점 수동 지정 (docs/2d-3d-conversion.md 교훈 #1)
- DXF 파일 손상 여부 확인

---

### 단계 2: 뷰 분리 & 폐곡선 추출

```bash
# 끊김 분석
node src/gaps.mjs gasiseol

# 폐곡선 검증
node src/build.mjs gasiseol --loops
```

**확인 항목**:
```
✓ 끊김 = 0
✓ 폐곡선 개수 예상과 일치
  (평면도: 4개, 단면: 8개 등)
✓ 자기교차 링 = 0 (중요!)
✓ 꼭짓점 수 정상 (4 = 정사각형, 8+ = 추가 형상)
```

**문제 시**:
- 자기교차: `docs/2d-3d-conversion.md` 교훈 #12, #18
- 끊김: 교훈 #3, #12

---

### 단계 3: IR 생성

```bash
node src/build.mjs gasiseol
```

**생성 파일**:
```
out/gasiseol.ir.json  (중간 표현)
```

**확인**:
- 파일 크기 > 1KB
- JSON 구문 유효

---

### 단계 4: 3D 모델 생성

```bash
# EGModeler로 3D 생성
python src/run_egm.py gasiseol --export=out/gasiseol.obj

# 또는 OBJ + IFC 동시 생성
python src/run_egm.py gasiseol --export=out/gasiseol.obj --ifc
```

**생성 파일**:
```
out/gasiseol.obj      (웹 렌더링용)
out/gasiseol.ifc      (BIM 표준, 선택)
```

**확인**:
```bash
# 파일 크기 확인
ls -lh out/gasiseol.*

# 정점 수 확인
grep "^v " out/gasiseol.obj | wc -l
# → 1000+ 정상
```

---

### 단계 5: 부피 검증

```bash
# IR 기준 부피 (의도)
node src/measure.mjs gasiseol --ir

# 모델러 측정 부피 (결과)
node src/measure.mjs gasiseol

# 기준값 저장
node src/measure.mjs gasiseol --baseline
```

**성공 기준**:
```
부피 오차 < 0.5%

예:
IR 부피: 100.50 m³
모델 부피: 100.45 m³
오차: 0.05% ✅
```

**실패 시**:
- assemble() 함수 재검토 (gasiseol.mjs)
- Boolean 손실 확인 (egm status에서 modelCount)
- `docs/2d-3d-conversion.md` 교훈 #14, #19

---

### 단계 6: 최종 검증

```bash
# 전체 검증
/validate --level=full

# 또는 커맨드 사용
node src/run.mjs gasiseol && \
node src/gaps.mjs gasiseol && \
node src/build.mjs gasiseol --loops && \
node src/build.mjs gasiseol && \
python src/run_egm.py gasiseol --export=out/gasiseol.obj && \
node src/measure.mjs gasiseol
```

---

## 📊 예상 결과물

### 파일 구조

```
out/
├── gasiseol.obj           (웹용 3D 모델)
│   └─ 크기: 500KB~5MB
│   └─ 정점: 1,000~50,000
│   └─ 면: 2,000~100,000
│
├── gasiseol.ifc           (BIM 표준)
│   └─ 크기: 200KB~2MB
│   └─ 포함: 부재 정보, 재질
│
└── gasiseol-validation.json
    └─ 부피, 검증 결과

baselines/
└── gasiseol.volumes.json  (기준값, 회귀 테스트용)
    {
      "irVolume": 245.823,
      "realVolume": 245.756,
      "error": 0.027,
      "status": "PASS"
    }
```

### 부피 예상

가시설(임시 구조물) 특성상:
```
소형 부재 예상:
- 기둥: 10~20 m³ 범위
- 보: 5~15 m³ 범위
- 전체: 50~300 m³

오차: 0~1% (정상)
```

---

## 🔍 문제 해결

### 오류 1: "DXF 파일을 찾을 수 없음"
```bash
# RAG 폴더 확인
ls -la RAG/가시설*.dxf

# 절대 경로 확인
file RAG/가시설_평면.dxf
```

### 오류 2: "폐곡선이 안 닫혀 있음"
```bash
# 자기교차 확인
node src/build.mjs gasiseol --loops | grep "✗"

# 원인 확인
node src/build.mjs gasiseol --debug
```

### 오류 3: "부피 오차 > 0.5%"
```bash
# IR 다시 계산
node src/build.mjs gasiseol --verbose

# assemble() 함수 검토
cat src/drawings/gasiseol.mjs | grep -A 20 "assemble("

# Boolean 문제 확인
egm status | grep modelCount
```

---

## ✅ 성공 신호

### 파일 생성됨
```
✅ out/gasiseol.obj 생성 (크기 > 0)
✅ baselines/gasiseol.volumes.json 저장
```

### 검증 통과
```
✅ 부피 오차 < 0.5%
✅ 폐면 (manifold) 체크 통과
✅ 렌더링 성공
```

### 웹 배포 준비
```
✅ OBJ 파일 준비 완료
✅ Three.js에서 로드 가능
✅ 부재 정보 추출 가능
```

---

## 🌐 웹 배포

```bash
# 3D 모델을 웹앱으로 로드
cd src/web
npm install
npm run dev

# 브라우저에서
http://localhost:3000
→ "가시설_평면.dxf" 업로드
→ 3D 모델 시각화
→ 부재 정보 조회
```

---

## 📈 성능 예상

| 단계 | 예상 시간 | 병목 |
|------|---------|------|
| 파일 검증 | 30초 | DXF 파싱 |
| 뷰 분리 | 30초 | 클러스터링 |
| 폐곡선 | 1분 | 위상 추적 |
| IR 생성 | 1분 | 프로파일 변환 |
| 3D 생성 | 3~5분 | EGModeler |
| 검증 | 1분 | 부피 계산 |
| **총** | **7~10분** | EGModeler |

---

## 🎯 다음 단계

```bash
# 1. 위 절차 실행
# ↓
# 2. 결과물 확인 (out/gasiseol.obj)
# ↓
# 3. 웹 배포
cd src/web && npm install && npm run build
# ↓
# 4. Vercel 배포
vercel --prod
```

---

## 📞 문제 시 연락

```
기하학 문제: docs/2d-3d-conversion.md 교훈 #1~#19
설정 파일: src/drawings/gasiseol.mjs
검증 실패: node src/measure.mjs gasiseol --ir (의도 확인)
배포 문제: FINAL-REPORT.md (배포 체크리스트)
```

