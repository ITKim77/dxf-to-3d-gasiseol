# 2D → 3D 제작 과정

DWG 도면 한 벌을 3D 솔리드로 세우기까지 **실제로 무엇을 어떤 순서로 했는지**를
기록한다. 다른 프로젝트로 옮길 때 이 문서만 따라가면 재현된다.

- 판단의 근거·함정·교훈은 [`2d-3d-conversion.md`](2d-3d-conversion.md) 에 따로 있다.
  이 문서는 **절차**, 그 문서는 **왜 그렇게 하는가**.
- 코드: [`src/`](../src/)
- 대상: `drawings-src/04manhole1-simplify.dwg` (맨홀 #1 및 출입구 일반도, 4매)

---

## 0. 준비물

| 항목 | 이 프로젝트에서의 위치 | 옮길 때 확인할 것 |
|---|---|---|
| DWG 파서 | `vendor/acadrust-dwg/` (wasm, read-only) | wasm 파일 2개(`.js`, `_bg.wasm`)를 같이 옮긴다 |
| Node | 18+ (ESM, top-level await 사용) | — |
| 3D 툴 | EGModeler + `egm` CLI (`D:\GiteaAll\EG-BIM_Modeler`) | 앱이 **실행 중**이어야 한다. `egm status` 로 확인 |
| Python | 3.10+ (`src/run_egm.py`) | 표준 라이브러리만 쓴다 |

`egm` 은 Named Pipe 로 실행 중인 EGModeler 에 명령을 보내는 CLI 다.
연결 확인:

```sh
egm status      # {"command":null,"modelCount":0,"selectedCount":0}
```

`EGModeler가 실행 중이지 않거나 응답하지 않습니다.` 가 나오면 앱을 먼저 띄운다.

**`status` 가 응답한다고 모델링이 되는 건 아니다.** 뷰어 모드면 모델링 명령이
등록조차 안 된 채로 파이프만 살아 있다. 등록된 명령 개수로 가른다.

```sh
egm guide | python -c "import sys,json;print(len(json.load(sys.stdin)))"
#  39  → 뷰어 모드. Polyline·Extrude·Boolean* 이 통째로 없다. 모델링 불가
# 207  → 정상
```

39 이 나오면 모델러 UI 에서 **Edit Mode** 로 바꾼다 (View Mode / Edit Mode 토글).
Assistive Features 의 `ModelerMode` 와는 다른 값이다. 자세한 배경은
[`2d-3d-conversion.md`](2d-3d-conversion.md) 교훈 #15.

---

## 1. 전체 흐름

```
DWG ─parse─→ 엔티티 ─segment─→ 뷰 ─datum─→ 프로젝트좌표 ─loops─→ 프로파일
                                                                    │
                                                        조립 스펙 (IR, JSON)
                                                   ↙        ↓        ↘
                                                 egm       IFC     three.js
```

명령 4개로 끝난다.

```sh
cd src

node src/run.mjs manhole1                      # ① 파싱 · 기준점 · 뷰 분리   → out/manhole1.views.json
node src/build.mjs manhole1                    # ② 프로파일 추출 · 조립      → out/manhole1.ir.json
node src/emit/egm.mjs out/manhole1.ir.json     # ③ 모델러 명령으로 번역      → out/manhole1.egm.json
python src/run_egm.py out/manhole1.egm.json    # ④ 실행
```

`src/run.mjs` 는 검증이 깨지면 **종료 코드 1** 을 낸다. CI 게이트로 바로 쓸 수 있다.

---

## 2. 단계별 절차

### ① 파싱 · 기준점 · 뷰 분리 — `src/run.mjs`

```sh
node src/run.mjs manhole1            # 산출물까지 저장
node src/run.mjs manhole1 --report   # 검증표만 출력
```

출력 예:

```
도면 manhole1 — R2018, 엔티티 7035

표고 기준선  DWG y = 483623.47666155506  (뷰 11곳에 반복, 총연장 61492mm)
  ✓ B-B 구체 상단  실측 -4907  도면 -4907
  ✓ B-B 기초 하단  실측 -7757  도면 -7757
  ✓ B-B 잡석 하단  실측 -8057  도면 -8057
  ✓ D-D 구체 상단  실측 -4907  도면 -4907

뷰            kind          조각    선     폭mm    높이mm   Z 범위
평 면 도         plan           1   72   20200   10200   -1478 ~ -11678 ✓
단 면 A-A       long           2  123   20200   10839   232 ~ -10607
...
✓ 검증 통과 — 뷰 분리와 표고 기준이 도면 치수와 일치
```

**이 단계를 통과하지 못하면 다음으로 가지 않는다.** 여기서 틀린 채로 3D 를
세우면 어디가 원인인지 알 수 없게 된다.

문제가 나오면:

| 증상 | 확인 도구 |
|---|---|
| 뷰가 없다 / 크기가 안 맞는다 | `node src/inspect.mjs manhole1 "<뷰>"` — 그 영역의 모든 엔티티를 레이어 무관하게 훑는다 |
| 기준점 검증 실패 | `datum.checks` 의 레이어 이름이 맞는지, 계획고 선이 `layers.ground` 에 잡히는지 |

### ② 프로파일 추출 · 조립 — `src/build.mjs`

```sh
node src/build.mjs manhole1 --loops   # 뷰별 폐곡선 목록 (조립 스펙 작성용)
node src/build.mjs manhole1           # IR 생성
```

`--loops` 출력이 조립 스펙을 쓰는 **재료 목록**이다.

```
단 면 B-B  (cross)
  # 0    2700×  2750  bbox[-1350..1350, -7657..-4907]  꼭짓점 4  부모 -
  # 1    2100×  2150  bbox[-1050..1050, -7357..-5207]  꼭짓점 10  부모 #0
  # 2    4300×   300  bbox[-2150..2150, -8057..-7757]  꼭짓점 4  부모 -
  # 3    2900×   100  bbox[-1450..1450, -7757..-7657]  꼭짓점 4  부모 -
```

폭×높이가 도면 표기 치수와 일치하는지 먼저 눈으로 확인한다. 여기가 맞으면
그 뒤는 거의 틀리지 않는다.

한 뷰만 자세히 보려면:

```sh
node src/probe.mjs manhole1 "단 면 B-B"          # 표
node src/probe.mjs manhole1 "단 면 B-B" --ring   # 꼭짓점 좌표까지
```

### ③ 모델러 명령으로 번역 — `src/emit/egm.mjs`

IR 의 연산을 egm 명령으로 바꾼다. 여기서만 egm 의 사정을 안다.

```
extrude    → Polyline(닫힌 커브) → SelByUids → Extrude C=True D F {벡터}
loft       → 단면마다 Polyline → SelByUids(단면 순서대로) → Loft C=True Enter
box        → Box {대각1} {대각2} {높이}
difference → SelByUids(base) → SelByUids(A=true, cutters) → BooleanDifference
union      → SelByUids(첫째) → SelByUids(A=true, 나머지) → BooleanUnion
```

`Loft` 는 기본이 **서피스**라 `C=True`(Cap)로 막아야 솔리드가 나온다.
단면 커브는 `L`(DeleteOriginal, 기본 true)로 자동 삭제된다. 별도 `Cap` 명령은
제자리 수정이라 새 uid 가 안 나오므로 여기서는 못 쓴다.

### ④ 실행 — `src/run_egm.py`

```sh
python src/run_egm.py out/manhole1.egm.json          # 실행
python src/run_egm.py out/manhole1.egm.json --dry    # 보내지 않고 명령만 출력
```

`--dry` 로 좌표를 먼저 검산하는 습관을 들이면 모델러를 왕복하지 않아도 된다.

```
[  0] duct.solid — extrude
  egm ~Polyline 0,-1.9,-7.757 0,1.9,-7.757 0,1.9,-3.157 0,-1.9,-3.157 0,-1.9,-7.757
  egm ~SelByUids A=false <duct.solid$crv> Esc
  egm ~Extrude C=True D F 0,0,0 15.4,0,0
```

---

## 3. 새 도면을 추가하는 절차

**코드는 건드리지 않는다.** `src/drawings/` 에 파일 하나만 추가한다.

### 3.1 뼈대 만들기

`src/drawings/manhole1.mjs` 를 복사해 이름을 바꾸고 `dwg` 경로를 고친다.
`layers` / `titles.views` 는 일단 대충 채우고 ①을 돌린다.

### 3.2 레이어 알아내기

```sh
node src/run.mjs <도면> --report      # 일단 실패해도 좋다
node src/inspect.mjs <도면> "<뷰>"    # 그 영역의 레이어 실태
```

`src/inspect.mjs` 는 레이어 필터를 무시하고 전부 보여준다. 여기서
구조체 외곽선이 어느 레이어에 있는지 눈으로 고른다.

### 3.3 레이어를 세 갈래로 나눈다

```js
layers: {
  struct:   /…/,   // 뷰 분리용. 넉넉하게. 가구·주기까지 들어가도 된다
  body:     /…/,   // 구체 프로파일용. 좁게. 케이블랙 같은 가구는 빼야 한다
  material: /…/,   // 기초·잡석·보도 등 별개 재료. 프로파일 추출엔 함께 넣는다
  ground:   /…/,   // 계획고·GL 선. 표고 기준 검출용
}
```

`body ⊆ struct` 는 코드가 강제한다(`src/run.mjs`). 어겨도 조용히 틀리지 않는다.

### 3.4 표고 기준 잡기

```js
datum: {
  levelLabel: /도로\s*계획고/,   // 기준선을 찾는 힌트. 값은 선에서 가져온다
  checks: [                      // 도면 치수와 대조. 최소 2개
    ['B-B 구체 상단', (v) => v['단 면 B-B']?.layerZ['-전력구']?.[1], -4907],
    ['B-B 기초 하단', (v) => v['단 면 B-B']?.layerZ['!-기초']?.[0], -7757],
  ],
}
```

`layerZ[레이어] = [최저 Z, 최고 Z]`. 도면에 적힌 치수를 그대로 넣는다.

### 3.5 뷰별 앵커 잡기

각 뷰의 u(가로) 좌표 중 무엇이 프로젝트 0 인지 정한다.
`--loops` 로 폐곡선 bbox 를 보고 도면 치수와 맞춰가며 찾는다.

```js
anchors: {
  '평 면 도':  { u0: 1000 },                            // u → X
  '단 면 B-B': { u0: 2150 },                            // u → Y (중심선)
  '단 면 F-F': { u0: -14700 },                          // XZ 단면
  '단 면 H-H': { u0: 1900, v0: -17125, swapUV: true },  // 수평 단면
}
```

| 옵션 | 뜻 |
|---|---|
| `u0` | 가로축 원점. `프로젝트 = u - u0` |
| `v0` | 세로축 원점. 수직 단면은 생략(표고가 이미 기준) |
| `flip` / `flipV` | 축 방향이 반대일 때 |
| `swapUV` | 도면 가로축이 프로젝트 Y, 세로축이 X 일 때 (수평 단면) |

### 3.6 조립 스펙 쓰기

파이프라인에서 **사람 판단이 들어가는 유일한 자리**다.

```js
assemble({ loop, profile, part, rect, expect }) {
  profile('duct.outer', 'YZ', loop('단 면 B-B', 2700, 2750).ring);
  part({ id: 'duct.solid', op: 'extrude', profile: 'duct.outer', axis: 'X',
         from: 0, to: 15400, cap: true, keep: false });
  ...
}
```

| 도우미 | 용도 |
|---|---|
| `loop(뷰, 폭, 높이)` | 그 치수의 폐곡선을 집는다. 0개나 2개 이상이면 예외 |
| `profile(id, 평면, ring)` | 프로파일 등록. 평면은 `'XY' \| 'XZ' \| 'YZ'` |
| `part({...})` | 파트 추가 |
| `rect(u0,v0,u1,v1)` | 직사각 프로파일. 폐곡선이 인접 형상과 붙어 못 쓸 때 |
| `expect(뷰, 폭, 높이, 이유)` | 그 폐곡선이 실재하는지 확인만. `rect` 값 교차검증용 |

IR 연산:

| op | 필드 |
|---|---|
| `box` | `min:[x,y,z]`, `max:[x,y,z]` |
| `extrude` | `profile`, `axis`, `from`, `to`, `cap` |
| `union` | `members:[id,…]` |
| `difference` | `base`, `cutters:[id,…]` |
| `loft` | `sections:[{profile, at},…]` — `at` 은 평면 법선축 위 위치 |

**loft 는 꺾인 자리를 못 만든다.** 두 단면 사이를 곧게 이을 뿐이라, 형상이
꺾이는 X 마다 단면을 놓고 구간을 끊어야 한다. 단면은 2개씩만 쓴다 — 3개
이상이면 스플라인 보간으로 부푼다. 두 단면은 **꼭짓점 수가 같아야** 하고,
링 정규화는 `addProfile` 이 자동으로 한다. 자세한 배경은
[`2d-3d-conversion.md`](2d-3d-conversion.md) 교훈 #16.

`keep: false` 는 boolean 에 소모될 중간 파트. 최종 산출물에만 `name`/`color` 를 준다.

---

## 4. 이 도면에서 실제로 만든 것

### 4.1 좌표계

```
X = 전력구 길이방향,  0 = 구조물 최좌단
Y = 폭방향,          0 = 전력구 중심선
Z = 표고,            0 = 도로 계획고 (DWG y = 483623.477, 자동 검출)
단위 = 내부 mm 정수, egm 넘길 때만 m
```

### 4.2 구간 구성 (A-A 종단면에서 읽음)

```
X  -1,000 ~      0   입구 스터브     B-B  구체 2,700×2,750
X       0 ~ 15,400   전력구 본체     C-C  구체 3,800×4,600 / 내부 3,000×3,800
X   1,900 ~  3,200   사다리 샤프트 1  Z -3,157 ~ 0
X  12,600 ~ 13,900   사다리 샤프트 2  Z -3,157 ~ -39
X  15,400 ~ 18,200   맨홀 #2         Z -10,007 ~ +182,  Y -1,900 ~ 8,300
X  18,200 ~ 19,200   출구 스터브     B-B
```

### 4.3 뷰 ↔ 부재 대응

| 뷰 | 평면 | 쓰인 곳 |
|---|---|---|
| 평 면 도 | XY | X 구간 확정, 샤프트 위치, 환기구 footprint |
| 단 면 A-A | XZ | **구간 배정표** — 어디서 어디까지 어느 단면인지 |
| 단 면 B-B / D-D | YZ | 스터브 단면 (2,700×2,750) |
| 단 면 C-C | YZ | 전력구 본체 단면 (3,800×4,600) |
| 단 면 E-E | YZ | 맨홀 전체 (챔버·격실·환기구 다리) |
| 단 면 F-F / G-G | XZ | 환기구 X 벽, 기초·잡석 |
| 단 면 H-H | XY | 환기 OPEN부 개구 (1.2×2.0) |
| 단 면 I-I | XY | 집수정 점검구 개구 (1.2×1.0) |
| 단 면 J-J | XY | 침사조·집수조 평면 (E-E 교차검증) |

### 4.4 최종 산출 파트

```
● 맨홀1_전력구_구체        스터브+본체 union 후 공동 차감
● 맨홀1_전력구_기초         4,000 × 100   fck=18MPa
● 맨홀1_전력구_잡석         5,400 × 500
● 맨홀1_전력구_출구스터브
● 맨홀1_사다리샤프트_1 / _2
● 맨홀1_맨홀2_구체         봉투 union 후 공동·개구부 차감
● 맨홀1_맨홀2_기초 / _잡석
● 맨홀1_환기구_기초 / _잡석
```

트리 이름은 `대분류_중분류_소분류` 형식이라 ObjectTreeViewer 에서 자동 그룹화된다.

---

## 5. 검증 절차

3D 를 세우기 **전에** 아래를 순서대로 통과시킨다. 한 단계라도 건너뛰면
나중에 어디가 원인인지 추적이 불가능해진다.

```
0. egm guide | wc -l          뷰어 모드가 아닌가 (39 면 뷰어 — 모델링 불가)
1. node src/run.mjs <도면>        지반선 Z 가 전 뷰에서 일치하는가
                              기준점이 도면 치수 2개 이상과 맞는가
                              뷰 폭·높이가 도면 치수와 맞는가
2. node src/gaps.mjs <도면>       프로파일이 안 닫히는 곳이 있는가
                              원인이 레이어 오분류인가 선 누락인가
3. node src/build.mjs <도면> --loops
                              폐곡선 치수가 도면 표기와 맞는가
   node src/build.mjs <도면> --circles
                              원 지름이 도면 표기(Ø900·Ø100)와 맞는가
   node src/report.mjs <도면>  → out/<도면>.html
                              **자기교차 링이 있는가** (있으면 압출부터 쓰레기다)
                              링을 그림으로 확인. 표로는 못 보이는 것이 보인다
4. node src/build.mjs <도면>      IR 검증 (참조 무결성, 소모 파트 keep 플래그)
5. python run_egm.py ... --dry
                              좌표가 예상대로 나오는가
6. python run_egm.py ... --export=out/<도면>.obj
                              실행 + OBJ 내보내기
7. egm status                 modelCount 가 최종 파트 수와 같은가
8. node src/measure.mjs <도면> --ir
                              의도(IR 격자 평가) vs 결과(모델러 OBJ) 대조
                              + 기준선 (실패 시 exit 1)
```

7 이 어긋나면 boolean 이 인자를 흘린 것이다 (교훈 #14). 형상만 봐서는 못 잡는다 —
남은 커터 솔리드가 구체와 겹쳐 있어 겉보기엔 멀쩡하다.

### 꼭짓점 수를 먼저 본다

`--loops` 출력에서 **직사각형이어야 할 것이 4가 아니면 의심**한다. 링이 오염됐다는
신호다. 이 도면에서 실제로 나온 값:

```
꼭짓점 4    정상 직사각형
꼭짓점 10   헌치(150×150)가 있는 정상 형상
꼭짓점 8    개구 기호(X 표시)가 사각형 안을 가로질러 링이 자기교차
꼭짓점 114  케이블 지지대가 프로파일 레이어에 섞임
```

링이 오염됐으면 **bbox 는 여전히 정확하므로** `rect()` 로 재구성하고
`expect()` 로 치수만 확인한다.

### 부피를 대조한다 — `src/measure.mjs`

비틀린 loft 는 형상만 봐서는 못 잡는다. 부피가 어긋나는 것으로만 드러난다.

```sh
python src/run_egm.py out/manhole1-trans.egm.json --export=out/manhole1-trans.obj
node src/measure.mjs manhole1-trans              # 기준선 대조 (실패 시 exit 1)
node src/measure.mjs manhole1-trans --save       # 지금 값을 기준선으로 얼린다
node src/measure.mjs manhole1-trans --primitives # IR 원시 파트 부피표도
```

OBJ 삼각형을 발산 정리로 잰다. `~SetObjectName` 으로 붙인 이름이 OBJ 의 `g` 로
나오므로 파트 대조가 이름 하나로 끝난다. 나오는 것:

```
파트                       부피 m³    표면적 m²   삼각형   열린변   재질
맨홀1_전력구_구체          100.5403    507.471    10862      28   구체 콘크리트 fck=27MPa
맨홀1_사다리샤프트_1         3.3217     28.356     3127      13   …
합계                      107.1425
```

**IR 에 없는 그룹이 나오면 boolean 이 인자를 흘린 것이다** — `modelCount` 대조와
같은 신호인데 어느 커터가 남았는지까지 알려준다.

`열린변`은 다양체 여부다. 이음매를 맞대어 붙이면 양쪽 삼각분할이 달라 T 정점이
남는다(교훈 #16). 부피·렌더링에는 문제가 없지만 IFC 로 갈 때 걸릴 수 있다.

#### 기준선은 `baselines/` 에 두고 **커밋한다**

`out/` 과 달리 재생성으로 복구되지 않는다. 사람이 한 번 확인한 부피가 남아야
다음 변경이 형상을 건드렸는지 알 수 있다.

#### 기대값은 자동으로 안 나온다 — 그리고 그게 맞다

`measure.mjs` 는 **boolean 을 합성하지 않는다.** 커터는 관통을 확실히 하려고
대상 밖으로 `OVER` 만큼 튀어나와 있고(교훈 #13), 샤프트 보어는 본체 공동과
겹친다. 그래서 `Σ멤버` 도 `base − Σ커터` 도 틀린 값이 된다. **틀린 기대값은
기대값이 없는 것보다 나쁘다.**

새 형상의 기대값은 `--primitives` 표를 재료로 사람이 한 번 조립하고, 맞으면
`--save` 로 얼린다. 두 단면 사이 면적은 t 의 2차식이라 심프슨
`L·(A0 + 4·A(½) + A1)/6` 이 **근사가 아니라 정확**하다.

```
duct.solid   5.1975 + 1.6540 + 0.9760 + 269.1920      = 277.0195
샤프트 1     원시합 5.3299 − 보어(솔리드 범위로 클립) 2.0084 = 3.3215   실측 3.3217
                                        └ 원기둥이 다면체로 나와 미세하게 크다
```

결과의 **정점 X 값에 중간 행이 없는지**도 같이 본다. 없으면 직선 룰드다.

### `src/gaps.mjs` 읽는 법

```
뷰                채택선    경계    레이어    누락   고치면 되는 레이어
단 면 J-J           22     0      0     0   —
단 면 E-E           69     1      3     0   잡석, 선형
```

| 열 | 뜻 | 대응 |
|---|---|---|
| 경계 | 뷰 밖으로 이어져 잘린 것 | 결함 아님. 무시 |
| 레이어 | 선은 있는데 다른 레이어에 있음 | `layers.body` 에 추가 (설정 한 줄) |
| 누락 | 도면에 선이 없음 | 도면 수정 또는 스냅 오차 확인 |

이 도면은 끊김 50곳 중 29곳이 뷰 경계, 20곳이 레이어 오분류, **선이 실제로
없는 곳은 1곳**(그것도 1mm 스냅 오차)이었다.

---

## 6. 도구 목록

| 파일 | 역할 |
|---|---|
| `src/run.mjs` | 파싱 · 기준점 검출 · 뷰 분리 · 검증 |
| `src/build.mjs` | 프로파일 추출 · 조립 스펙(IR) 생성 |
| `src/emit/egm.mjs` | IR → egm 명령 목록 |
| `src/run_egm.py` | 명령 실행 (`--dry`, `--export=<obj>` 지원) |
| `src/measure.mjs` | OBJ 부피 실측 · 기준선 대조 · 재질별 물량 |
| `src/report.mjs` | 추출 결과 뷰어 (한 장짜리 HTML). 링 그림 · 자기교차 · 원 · IR |
| `src/capture.mjs` | 뷰별 **도면** 캡처 + 좌표 사이드카 (전 레이어, `--crop`·`--png`) |
| `src/render.mjs` | 만든 **3D** 를 정투영 렌더 (`--axis`·`--part`·`--clip`·`--png`) |
| `src/volume.mjs` | IR 을 격자로 평가 — 모델러 없이 "의도" 부피 |
| `src/fit.mjs` | 도면 → `params/<이름>.json` |
| `src/params.mjs` | 파라미터 스키마·식·검증 |
| `src/rules.mjs` | 설계 규칙 (위상은 막고, 설계는 경고) |
| `src/ui.mjs` | 파라미터 편집 + 갱신 UI (로컬 서버) |
| `src/core/views.mjs` | 뷰 → 프로젝트 좌표. `build.mjs` 와 `report.mjs` 가 **같이 쓴다** |
| `src/probe.mjs` | 뷰 하나의 폐곡선을 표로 (`--ring` 으로 좌표까지) |
| `src/gaps.mjs` | 프로파일 끊김 진단 + 원인 분류 |
| `src/inspect.mjs` | 뷰 영역의 모든 엔티티를 레이어 무관하게 |
| `src/materials.mjs` | 뷰별 재질 주기 수집 · 레이어 ↔ 재질 대응 확인 |
| `src/core/parse.mjs` | DWG → 엔티티, 선분 펴기, 표제 수집 |
| `src/core/datum.mjs` | 표고 기준 검출 · 좌표 변환 |
| `src/core/segment.mjs` | 뷰 분리 (교대 간격분할 + 제목 귀속) |
| `src/core/loops.mjs` | 선분 → 닫힌 프로파일 (평면 분할) |
| `src/ir.mjs` | 조립 스펙 스키마 · 빌더 · 검증 |
| `src/drawings/*.mjs` | **도면별 설정.** 새 도면은 여기에 파일 하나 |
| `src/drawings/manhole1-trans.mjs` | 전이부만 세우는 최소 모델. `manhole1` 설정을 상속하고 `assemble()` 만 교체 — 한 부분을 떼어 검증할 때의 본보기 |

---

## 7. 모델러 조작 시 주의

`Modeler_AI/docs/egm-usage.md` 중 이 작업에서 특히 물리기 쉬운 것.

- **`Extrude C=True` 단독은 항상 +Z 로 민다.** 커브 평면의 법선을 따르지 않는다.
  `src/emit/egm.mjs` 는 항상 `D F {기준점} {방향점}` 으로 방향을 명시한다.
- **`C=True` 는 `D F` 앞에** 와야 한다. 뒤에 오면 무시되고 서피스가 나온다.
- **닫힌 `Polyline` 에 `Enter` 를 붙이지 말 것.** 자동 종료되므로 남은 신호가
  다음 명령으로 새어나간다.
- **`SelByUids` 는 `Esc` 로 닫는다.** 안 닫으면 이후 명령이 전부 무시된다.
- 명령은 비동기다. `egm status` 의 `command` 가 `null` 이 될 때까지 기다린다.
  `src/run_egm.py` 의 `wait()` 가 그 일을 한다.
- **`BooleanDifference`/`BooleanUnion` 은 두 개만 먹는다.** 플러그인이
  `TargetModels[0]`, `[1]` 만 쓰므로 셋 이상 선택하면 나머지는 조용히 무시된다.
  `src/emit/egm.mjs` 의 `fold()` 가 둘씩 접는다.
- **뷰어 모드면 모델링 명령이 등록조차 안 된다.** 0절의 `egm guide` 확인을
  건너뛰지 말 것.
- **`ExportByPath` 의 경로는 반드시 큰따옴표로 감싼다.** `_` 가 egm 스크립트
  특수문자라, 경로에 밑줄이 있으면 오류도 경고도 없이 **아무 파일도 안 생긴다**.
  `result` 는 정상으로 보이고 `created:[]` 도 원래 그런 명령이라 신호가 없다.
  내보내기 전에 `SelAll` 이 필요하고, `.obj` 만 나온다(`.stl` 은 파일이 안 생긴다).
  `src/run_egm.py` 의 `export_obj()` 가 이걸 다 하고 파일 생성까지 확인한다.

### 씬 초기화가 실패할 때

`SelAll` → `Delete` 직후 상태가 남아 다음 명령이 씹히는 경우가 있다.

```sh
egm "Esc"; egm "!Cancel"; egm "SelAll"; egm "Delete"; egm "Esc"; egm "!Cancel"
egm status      # command 가 null 인지 확인
```

---

## 8. 현재 미완

| 항목 | 상태 | 필요한 것 |
|---|---|---|
| 전이부 챔퍼 | `manhole1-trans` 에서 완성 (챔퍼·단차·종방향 헌치) | `manhole1` 본편에 이관 |
| 이음매 T 정점 | 열린 변 21개 (기하는 닫힘) | IFC 내보낼 때 재검토 |
| Φ100 관통 ×5 | 미구현 | 평면도에서 전선인입 2 · 우수관연결 2 · 유도배수관 1 위치 특정 |
| 나선계단 | 미구현 | 현 IR 연산으로 표현 불가. `Sweep1` 또는 전용 연산 추가 |
| 방호난간 L=7.2m | 미구현 | H-H 에 표기 |
| IFC 출력 | 미구현 | `emit/ifc.mjs`. 레이어 ↔ 재질 매핑은 이미 확보 |
| 브라우저 연동 | 미구현 | `src/core/*` 순수화 + localhost 브리지 |
