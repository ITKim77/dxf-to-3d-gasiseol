# DXF 가시설 도면 → 3D 통합모델 뷰어

가시설 도면(평면도·단면도)에서 부재 위치와 규격을 읽어 3D 통합모델을 만들고, 웹에서 검토하는 프로젝트입니다.

## 1. 웹에서 보기

https://itkim77.github.io/dxf-to-3d-gasiseol/

설치 없이 브라우저에서 바로 열 수 있습니다. 화면 왼쪽 패널이 조작 메뉴입니다.

## 2. 조작 방법

| 동작 | 방법 |
|---|---|
| 회전 | 왼쪽 버튼 드래그 |
| 이동 | 오른쪽 버튼 드래그 |
| 확대·축소 | 휠 (커서가 가리키는 곳을 중심으로 부드럽게 바뀜) |
| 보이는 부재 맞춤 | "줌핏 (보이는 부재)" 버튼 |
| 시점 전환 | 정면 · 평면 · 측면 · 등각 버튼 |
| 거리 측정 | "거리 측정" 켜기 → 부재 표면을 두 번 클릭 → 거리와 ΔX·ΔY·ΔZ 표시 |
| 측정 지우기 | "측정 지우기" 버튼 |
| 부재 표시/숨김 | 종류별 체크박스 (옆 숫자는 개수) |
| 투명도 | 종류별 투명도 슬라이더 (0.1 ~ 1) |
| 굴착면 표시 | "굴착면 표시" 체크박스 |

## 3. 부재 구성 (총 419개)

| 부재 | 개수 | 비고 |
|---|---|---|
| 엄지말뚝 | 122 | H400×400×13/21, 길이 8.5m |
| 토류판 | 120 | T=100, 말뚝 사이 충진 |
| 띠장 | 48 | H300×300×10/15, 2단 |
| 수직 PIECE | 52 | H300, 띠장 쌍 연결 |
| 버팀보 | 26 | H300, 2단 |
| 스크류잭 | 26 | 1000kN, 버팀보당 한쪽 |
| 채널 | 12 | ㄷ-380×100×10.5/16 |
| 중간말뚝 | 13 | H300×300×10/15 |

굴착면과 도로면은 별도 면으로 표시됩니다.

## 4. 저장소 구조

```
src/build/generate-v4.mjs   통합모델 데이터 생성 (도면 → out/gasiseol-v4-stats.json)
src/build/verify-v4.mjs     검증 (부재 수량, 간섭)
out/viewer-v4.html          뷰어 원본
out/gasiseol-v4-stats.json  통합모델 데이터
site/                       웹 배포용 파일 (gh-pages 브랜치로 배포)
PROGRESS.md                 진행 기록과 열린 가정 목록
```

## 5. 직접 실행하기

**준비**
- Node.js 18 이상
- `npm install` (dxf-parser, three)
- 도면 원본 `RAG/LH/가시설계획_LH.dxf`, `RAG/LH/가시설상세_LH.dxf`. 이 폴더는 저장소에 포함되어 있지 않으므로 직접 준비해야 합니다.

**데이터 생성과 검증**
```
node src/build/generate-v4.mjs   # 통합모델 데이터 생성
node src/build/verify-v4.mjs     # 수량·간섭 검증 (실패 시 종료 코드 1)
```

**로컬에서 뷰어 열기**
```
cd out
python -m http.server 8000
```
브라우저에서 `http://localhost:8000/viewer-v4.html`을 엽니다. 파일을 더블클릭으로 열면 데이터를 읽지 못하므로 반드시 서버로 열어야 합니다.

**웹에 반영하기**
```
cp out/viewer-v4.html site/index.html
cp out/gasiseol-v4-stats.json site/
git add site && git commit -m "배포 갱신"
git subtree split --prefix site -b gh-pages-site
git push -f origin gh-pages-site:gh-pages
git branch -D gh-pages-site
```

## 6. 확인이 필요한 가정

도면에 없어서 추정한 값입니다. 자세한 내용은 `PROGRESS.md`를 봐 주세요.
- 도로면 폭 10m
- 토류판 높이 = 말뚝 길이 8.5m
- 스크류잭 폭 0.3m
- 채널 길이 = 중간말뚝 묶음 범위
- 버팀보 X 간격 = 도면 치수 "11@5.000" 기준 (13지점)
