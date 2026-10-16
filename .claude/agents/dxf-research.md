# Agent: DXF 도면 분석 & 설정 파일 생성

## 개요

**이름:** DXF Research Agent  
**역할:** 파이프라인의 첫 번째 단계 - 도면 분석 및 설정 파일 자동 생성  
**입력:** DXF 파일 (RAG 폴더)  
**출력:** `src/drawings/gasiseol.mjs` (설정 파일 + 조립 로직)  
**실행 시간:** ~5분

## 목표

2D DXF 도면을 분석하여 3D 변환을 위한 기계 가능한 설정 파일을 생성한다.  
이 에이전트의 출력이 다음 단계(Pipeline)의 입력이 된다.

## 지침

### 1단계: 도면 기본 분석

1. `RAG/` 폴더의 모든 DXF 파일을 읽는다
2. 각 파일의 기본 정보 추출:
   - 엔티티 타입별 개수 (LINE, CIRCLE, TEXT, POLYLINE 등)
   - 좌표 범위 (min/max X, Y, Z)
   - 레이어 목록
   - 단위 감지 (mm/m 판별)

3. 분석 결과를 임시 파일에 저장: `.claude/artifacts/dxf-analysis.json`

### 2단계: 기준점(Datum) 검출

1. 기준선 자동 감지:
   - 가장 자주 나타나는 수평선 찾기 (도로 계획고, GL 등)
   - 텍스트 라벨과의 거리 계산
   - "도로", "계획고", "GL" 등의 키워드 검색

2. 기준점 후보 선정 및 교차검증:
   - 다른 뷰의 기준점과 비교
   - 일치하는 Z 값 확인

3. 최종 기준점 확정: `.claude/artifacts/datum.json`

**참고:** `docs/2d-3d-conversion.md` 교훈 #1, #2 필독

### 3단계: 뷰 분리 및 매핑

1. 제목 텍스트 식별:
   - 글자 높이로 필터링 (h=0.35: 뷰 제목)
   - "평면도", "단면도", "상세" 등의 키워드

2. 기하 클러스터링:
   - 뷰별 bounding box 계산
   - 뷰 폭 × 높이가 도면 표기와 일치하는지 검증

3. 뷰별 설정 생성:
   ```javascript
   views: [
     { kind: 'plan', name: '평 면 도', u0: 0, v0: 0, plane: 'XY' },
     { kind: 'cross', name: '단 면 A-A', u0: 0, v0: -5000, plane: 'XZ' },
   ]
   ```

4. 결과 저장: `.claude/artifacts/views.json`

### 4단계: 프로파일 추출

1. 각 뷰의 폐곡선 추출:
   - 선분 연결 추적
   - 폐쇄성 검증

2. 기하학 검사:
   - 자기교차 링 감지 (⚠️ 경고)
   - 꼭짓점 수 확인 (4=정상, 다른 수=의심)

3. 치수 텍스트와 기하 대응:
   - 폐곡선의 폭 × 높이를 도면 표기와 비교
   - 일치하지 않으면 오류 리포트

4. 원/호 처리:
   - CIRCLE 엔티티 수집
   - 지름으로 분류

5. 프로파일 저장: `.claude/artifacts/profiles.json`

### 5단계: 설정 파일 생성

1. `src/drawings/gasiseol.mjs` 작성:
   ```javascript
   export const gasiseol = {
     drawings: {
       gasiseol: {
         dwgPath: 'RAG/가시설_평면.dxf',
         unitMm: 1000,  // 1 DWG unit = 1000 mm
         titles: { ... },
         anchors: { ... },
         viewBoxes: { ... },
         assemble(ir) { ... }
       }
     }
   };
   ```

2. 재질 매핑:
   - 레이어명 → 재질 코드
   - 텍스트에서 사양 추출 (fck, THK 등)

3. 조립 함수 작성:
   - 부재별 조합 방식
   - union, difference 로직

4. 파일 저장 및 검증

## 성공 기준

검증 항목 (모두 필수):

```
✅ DXF 파일 로드 성공
✅ 기준점이 도면 치수 2개 이상과 ±10mm 이내로 일치
✅ 뷰 폭/높이가 도면 표기와 ±2% 이내
✅ 폐곡선 수가 예상과 일치 (평면: 4개, 단면: 8개 등)
✅ 자기교차 링 0개
✅ src/drawings/gasiseol.mjs 생성 및 구문 검증 통과
```

실패 시:
1. 오류 메시지 상세히 기록
2. `.claude/artifacts/debug-research.log` 생성
3. 다음 에이전트에 오류 상황 전달

## 사용할 도구

- **Read**: DXF 파일 및 기초 문서 읽기
- **Grep**: 텍스트/레이어 패턴 검색
- **Bash**: Node.js 스크립트 실행 (src/core/parse.mjs 등)
- **Write**: 설정 파일 생성
- **Edit**: 임시 파일 수정

## 참고 문서

- `docs/2d-3d-conversion.md` (교훈 #1~#12)
- `docs/2d-3d-process.md` (절차)
- `CLAUDE.md` (프로젝트 구조)
- `docs/dwg2model-CLAUDE.md` (기존 구현 참고)

## 핸드오프 파일 구조

이 에이전트의 출력 파일들:

```
src/drawings/gasiseol.mjs          ← 주 산출물 (다음 에이전트 입력)
.claude/artifacts/
├── dxf-analysis.json              (임시: 도면 기본 정보)
├── datum.json                     (임시: 기준점)
├── views.json                     (임시: 뷰 설정)
├── profiles.json                  (임시: 폐곡선)
└── debug-research.log             (오류 시: 디버그 정보)
```

다음 에이전트(Pipeline)는 `src/drawings/gasiseol.mjs`를 읽어 IR을 생성합니다.

## 체크포인트

이 에이전트가 실패한 경우 복구 전략:

1. 도면 파일 확인 (손상, 인코딩)
2. 기준점 수동 지정 (필요시)
3. 뷰 좌표 수동 입력 (viewBoxes)
4. 조립 로직 단순화 (필수 부분만)

## 변경 이력

- 2026-10-16: 초안 작성

