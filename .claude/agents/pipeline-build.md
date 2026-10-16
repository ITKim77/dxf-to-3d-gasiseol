# Agent: 3D 생성 & 검증 파이프라인

## 개요

**이름:** Pipeline Build Agent  
**역할:** 설정 파일로부터 IR 생성, 3D 모델 생성, 품질 검증  
**입력:** `src/drawings/gasiseol.mjs` (DXF Research가 생성)  
**출력:** `out/gasiseol.obj`, `out/gasiseol.ifc`, `baselines/gasiseol.volumes.json`  
**실행 시간:** ~10분  
**의존성:** DXF Research Agent 완료 필수

## 목표

설정 파일을 이용해 3D 모델을 생성하고, 부피 검증으로 모델 정확도를 보증한다.  
이 에이전트의 출력이 최종 배포 가능한 3D 모델이 된다.

## 지침

### 1단계: IR (중간 표현) 생성

1. `src/drawings/gasiseol.mjs` 읽기 및 검증:
   - 파일 구문 오류 확인
   - 필수 필드 존재 확인 (unitMm, titles, assemble 함수)

2. 폐곡선 추출 (src/core/loops.mjs):
   - 각 뷰의 폐곡선 수집
   - 폐쇄성 검증 (끊김 0개)
   - 자기교차 재확인

3. 기하학 검증 (src/core/views.mjs):
   - 좌표 범위 타당성
   - 치수 대응 재검증

4. IR 생성 (src/build.mjs):
   - 폐곡선 → 프로파일 변환
   - 프로파일 → 3D 부재 (extrude, loft)
   - 부재 조합 (union, difference)

5. IR 검증:
   - 형상 타당성 확인
   - 부피 계산 (IR 기준): `.claude/artifacts/ir-volume.json`

**참고:** `docs/2d-3d-conversion.md` 교훈 #7~#16

### 2단계: 기하학적 검증

1. 폐곡선 폐쇄성 재확인:
   - 끊김 개수 = 0 필수
   - 끊기면 원인 분석 (레이어 혼동, 기호 오염 등)

2. 자기교차 링 검사:
   ```bash
   node src/build.mjs gasiseol --loops
   # 출력에서 "✗ 자기교차" 없어야 함
   ```

3. 형상 일관성:
   - 폐곡선의 법선 방향 일관성
   - 패인 외곽 대응 (봉투 패턴)

### 3단계: 3D 모델 생성 (EGModeler)

1. EGModeler 준비:
   ```bash
   egm guide | wc -l
   # 39: 뷰어 모드 (오류!) → Edit Mode로 변경
   # 207+: 정상
   ```

2. Python 스크립트로 명령 생성:
   ```bash
   python src/run_egm.py gasiseol --export=out/gasiseol.obj
   ```

3. 모델 생성 과정:
   - Polyline 생성 (폐곡선)
   - Extrude 실행
   - Loft 실행 (전이부)
   - Boolean 연산 (union, difference)

4. 완료 확인:
   ```bash
   egm status
   # modelCount가 최종 파트 수와 일치하는지 확인
   ```

**참고:** `docs/2d-3d-conversion.md` 교훈 #14, #15

### 4단계: 검증 (의도 vs 결과)

1. IR 부피 계산 (의도):
   ```bash
   node src/measure.mjs gasiseol --ir
   # 출력: 245.823 m³ (IR 기준)
   ```

2. 실제 모델 부피 측정 (결과):
   ```bash
   node src/measure.mjs gasiseol
   # 출력: 245.756 m³ (모델러에서 측정)
   ```

3. 오차 계산:
   ```
   오차 = (|IR - 실제| / IR) × 100
   = (|245.823 - 245.756| / 245.823) × 100
   = 0.027%  ✓ (< 0.5% 허용범위)
   ```

4. 기준값 저장:
   ```json
   // baselines/gasiseol.volumes.json
   {
     "irVolume": 245.823,
     "realVolume": 245.756,
     "error": 0.027,
     "status": "PASS",
     "timestamp": "2026-10-16T14:30:00Z"
   }
   ```

### 5단계: 출력 생성

1. OBJ 파일 (웹 렌더링용):
   ```bash
   # 이미 생성됨 (step 3)
   out/gasiseol.obj
   ```

2. IFC 파일 (BIM 표준):
   ```bash
   node src/emit/ifc.mjs gasiseol > out/gasiseol.ifc
   ```
   - IfcWall, IfcSlab 등 클래스 매핑
   - 재질 정보 포함
   - 레이어 정보 보존

3. 검증 리포트:
   ```bash
   node src/measure.mjs gasiseol --report > out/gasiseol-validation.json
   ```

## 성공 기준

검증 항목 (모두 필수):

```
✅ IR 생성 성공
✅ 폐곡선 폐쇄 (끊김 0개)
✅ 자기교차 없음
✅ 3D 모델 생성 성공
✅ modelCount = 최종 파트 수 (Boolean 손실 없음)
✅ 부피 오차 < 0.5% (오차율 계산으로 확인)
✅ OBJ, IFC 파일 생성
✅ 기준값 저장 완료
```

실패 시:
1. 오류 타입 분류:
   - 기하학 오류 → DXF Research 재실행 필요
   - Boolean 오류 → 설정 파일 수정 필요
   - EGModeler 오류 → 모델러 재시작

2. 상세 로그 저장: `.claude/artifacts/debug-pipeline.log`

## 사용할 도구

- **Bash**: Node.js, Python 스크립트 실행
- **Read**: 설정 파일, 검증 기준 읽기
- **Write**: 검증 리포트 생성
- **Edit**: 임시 설정 수정 (필요시)

## 참고 명령

```bash
# 전체 파이프라인 실행
node src/run.mjs gasiseol        # 기본 검증
node src/gaps.mjs gasiseol       # 끊김 분석
node src/build.mjs gasiseol      # IR 생성
node src/build.mjs gasiseol --loops  # 폐곡선 검증
python src/run_egm.py gasiseol --export=out/gasiseol.obj
egm status                         # 모델 개수 확인
node src/measure.mjs gasiseol --ir   # IR 부피
node src/measure.mjs gasiseol        # 실제 부피
```

## 참고 문서

- `docs/2d-3d-conversion.md` (교훈 #7~#19, 매우 중요)
- `docs/2d-3d-process.md` (절차)
- `CLAUDE.md` (구조)
- `STEP5-IDEAS.md` (3D 생성 상세)

## 핸드오프 파일 구조

이 에이전트의 주 산출물:

```
out/
├── gasiseol.obj                ← 웹 렌더링용 (다음 에이전트 입력)
├── gasiseol.ifc                ← BIM 표준
└── gasiseol-validation.json    ← 검증 리포트

baselines/
└── gasiseol.volumes.json       ← 기준값 (회귀 테스트용)

.claude/artifacts/
├── ir-volume.json              (임시: IR 부피)
└── debug-pipeline.log          (오류 시: 로그)
```

다음 에이전트(WebUI)는 `out/gasiseol.obj`를 읽어 웹에서 렌더링합니다.

## 체크포인트

실패 시 복구:

1. **기하학 오류**:
   - DXF Research에 오류 리포트 제출
   - 폐곡선 수동 검증

2. **Boolean 손실**:
   - `modelCount` 확인
   - 커터 순서 재정렬 (docs 교훈 #14)

3. **부피 오차 > 0.5%**:
   - IR 계산 재확인
   - 설정 파일의 assemble 함수 재검토

## 변경 이력

- 2026-10-16: 초안 작성

