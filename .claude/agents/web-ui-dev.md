# Agent: 웹앱 & 3D 뷰어 개발

## 개요

**이름:** WebUI Development Agent  
**역할:** React 웹앱 + Three.js 3D 뷰어 개발  
**입력:** 3D 모델 (out/gasiseol.obj), UI 요구사항  
**출력:** `src/web/` (완성된 React 프로젝트)  
**실행 시간:** ~10분  
**병렬:** Pipeline과 독립적 (동시 진행 가능)

## 목표

사용자가 브라우저에서 3D 모델을 실시간으로 보고, 상호작용할 수 있는 웹앱을 개발한다.

## 지침

### 1단계: 프로젝트 초기화

```bash
cd src/web
npm create vite@latest . -- --template react-ts
npm install
npm install three @react-three/fiber @react-three/drei
npm install zustand tailwindcss
```

폴더 구조:
```
src/web/
├── src/
│   ├── components/
│   │   ├── Viewer3D.tsx
│   │   ├── FileUpload.tsx
│   │   ├── PropertyPanel.tsx
│   │   ├── Controls.tsx
│   │   └── StatusBar.tsx
│   ├── hooks/
│   ├── pages/
│   ├── styles/
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── models/  (3D 모델 파일)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 2단계: 핵심 컴포넌트 개발

1. **Viewer3D.tsx**: Three.js 3D 렌더링
   - Canvas 설정 (width 100%, height 100vh)
   - OrbitControls (마우스 조작)
   - 모델 로드 (OBJLoader)
   - 기본 조명 (AmbientLight, DirectionalLight)
   - 그리드 & 축 표시

2. **FileUpload.tsx**: DXF 파일 업로드
   - 드래그 & 드롭
   - 파일 선택 다이얼로그
   - 유효성 검사 (.dxf만)

3. **PropertyPanel.tsx**: 부재 정보 표시
   - 부재명 (레이어)
   - 재질 정보
   - 부피 표시
   - 좌표 범위

4. **Controls.tsx**: UI 조작
   - 뷰 전환 버튼 (Top, Front, Side)
   - 줌 리셋
   - 투명도 조절
   - 레이어별 표시/숨김 토글

5. **StatusBar.tsx**: 상태 표시
   - 변환 진행률
   - FPS (프레임/초)
   - 메모리 사용량

### 3단계: Three.js 최적화

1. 모델 로드:
   ```typescript
   const loader = new OBJLoader();
   loader.load('/models/gasiseol.obj', (object) => {
     scene.add(object);
     // 자동 줌
     new THREE.Box3().setFromObject(object);
   });
   ```

2. 성능 최적화:
   - 정점 최적화 (BufferGeometry)
   - 인덱싱 (면 데이터 압축)
   - 스케일: 100,000개 이상 면도 60fps 유지

3. 라이팅 설정:
   - AmbientLight (기본 조명): 0xffffff 50%
   - DirectionalLight (그림자): 0xffffff 80%

### 4단계: 상호작용 구현

1. 부재 선택:
   - Raycaster로 클릭된 부재 감지
   - 선택 시 색상 변경 (노랑/초록)
   - PropertyPanel에 정보 표시

2. 측정 기능:
   - 두 점 선택 → 거리 계산
   - 면 선택 → 면적 계산

3. 단면 표시:
   - 평면 설정 (XY, XZ, YZ)
   - 단면 위치 슬라이더
   - 단면과 교차하는 부분만 표시

### 5단계: 배포 최적화

1. 번들 최소화:
   ```bash
   npm run build
   # 결과 크기 < 500KB 목표
   ```

2. 이미지 압축:
   - favicon, 로고 등 최적화

3. 지연 로딩:
   - 3D 모델 async 로드
   - 스켈레톤 로더 표시

4. 성능 모니터링:
   - FPS 표시 (오른쪽 상단)
   - 로드 시간 측정
   - Core Web Vitals 모니터링

## 성공 기준

```
✅ 프로젝트 초기화 완료
✅ 3D 모델 로드 성공
✅ 기본 조명 설정 (명확한 시각)
✅ 마우스 조작 가능 (회전, 줌, 패닝)
✅ 부재 선택 & 정보 표시
✅ 초기 로딩 < 3초
✅ 렌더링 60fps 유지
✅ 번들 크기 < 500KB
✅ 모바일 반응형 (가로/세로 자동 전환)
✅ 터치 제스처 지원 (pinch zoom)
```

## 사용할 도구

- **Write**: 컴포넌트, 설정 파일 작성
- **Bash**: npm 명령 실행, 빌드
- **Edit**: 코드 수정

## 참고 기술

- **React 18+**: 함수형 컴포넌트, hooks
- **TypeScript**: 타입 안전성
- **Three.js**: 3D 렌더링
- **Vite**: 빠른 개발/빌드
- **TailwindCSS**: UI 스타일

## 개발 명령

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프리뷰 (배포 전)
npm run preview
```

## 핸드오프 파일

이 에이전트의 산출물:

```
src/web/                    ← 완성된 웹앱
├── src/components/
├── src/hooks/
├── src/pages/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── public/models/gasiseol.obj  ← Pipeline이 제공
```

다음 에이전트(Deploy)는 이 폴더를 `npm run build`로 빌드하고 배포합니다.

## 체크포인트

실패 시 복구:

1. **모델 로드 실패**:
   - `out/gasiseol.obj` 파일 확인
   - OBJLoader 경로 재확인

2. **성능 저하**:
   - 정점 수 확인
   - 조명 수 줄이기
   - 텍스처 제거

3. **모바일 문제**:
   - 터치 이벤트 디버깅
   - 뷰포트 메타 태그 확인

## 변경 이력

- 2026-10-16: 초안 작성

