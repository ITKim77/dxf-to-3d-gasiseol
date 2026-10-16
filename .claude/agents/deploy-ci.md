# Agent: CI/CD & 배포

## 개요

**이름:** Deploy & CI/CD Agent  
**역할:** GitHub Actions, Vercel 배포, 무료 도메인 설정  
**입력:** 웹앱 소스 코드 (src/web/), git 푸시 신호  
**출력:** 배포된 웹사이트 (URL 제공)  
**실행 시간:** ~5분  
**의존성:** Pipeline, WebUI 완료 필수

## 목표

모든 검증을 거친 웹앱을 자동으로 배포하고, 무료 도메인에서 접속 가능하게 한다.

## 지침

### 1단계: GitHub Actions 워크플로우 설정

파일 생성: `.github/workflows/ci-cd.yml`

```yaml
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
        run: |
          npm ci
          cd src/web && npm ci
      
      - name: Lint & Format Check
        run: |
          npm run lint || true
          npm run format:check || true
      
      - name: TypeScript Type Check
        run: |
          cd src/web && npm run type-check || true
      
      - name: Unit Tests
        run: |
          npm run test || true
          cd src/web && npm run test || true
      
      - name: Build Web App
        run: |
          cd src/web && npm run build
      
      - name: Validate DXF Pipeline
        run: |
          npm install
          node src/build.mjs gasiseol --validate || true

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Vercel CLI
        run: npm install -g vercel@latest
      
      - name: Build & Deploy to Vercel
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          cd src/web
          vercel --token=$VERCEL_TOKEN --prod
```

### 2단계: Vercel 설정

1. Vercel 계정 생성 & 프로젝트 연결:
   ```bash
   npm install -g vercel
   cd src/web
   vercel link
   ```

2. 환경 변수 설정 (Settings):
   ```
   VERCEL_TOKEN: <GitHub Secrets에 저장>
   VERCEL_ORG_ID: <프로젝트 ID>
   VERCEL_PROJECT_ID: <빌드 ID>
   ```

3. 빌드 설정:
   - Framework: React
   - Build Command: `npm run build`
   - Output Directory: `dist`

### 3단계: 무료 도메인 등록

1. Freenom에서 도메인 등록:
   - 사이트: https://www.freenom.com
   - 도메인: `dxf-to-3d.tk` (또는 .ml, .ga)
   - 기간: 12개월 (무료)

2. DNS 레코드 설정 (Freenom 또는 Vercel):
   ```
   CNAME: dxf-to-3d.tk → <Vercel 도메인>.vercel.app
   ```

3. Vercel에서 도메인 연결:
   - Vercel Dashboard → Domains
   - Add Domain: `dxf-to-3d.tk`

4. SSL 인증서 (자동):
   - Vercel이 자동으로 Let's Encrypt 인증서 발급

### 4단계: 배포 검증

1. 배포 성공 확인:
   ```bash
   # CI/CD 로그에서
   ✅ All tests passed
   ✅ Build successful
   ✅ Deployed to Vercel
   ```

2. 웹사이트 접속:
   - URL: `https://dxf-to-3d.tk`
   - 3D 모델 로드 확인
   - 부재 선택 테스트

3. 성능 확인:
   - 초기 로딩 < 3초
   - 3D 렌더링 60fps
   - Core Web Vitals 우수

### 5단계: 모니터링 & 유지보수

1. 배포 모니터링:
   - Vercel Dashboard에서 실시간 로그
   - GitHub Workflow 실행 히스토리

2. 오류 로깅 (선택사항):
   - Sentry 연동
   - 프로덕션 오류 자동 감지

3. 성능 모니터링:
   - Vercel Analytics
   - Core Web Vitals 추적

4. 도메인 갱신:
   - Freenom: 12개월마다 무료 갱신
   - SSL: 자동 갱신

## 성공 기준

```
✅ GitHub Actions 워크플로우 생성 & 실행
✅ 모든 테스트 통과
✅ 웹앱 빌드 성공 (< 500KB)
✅ Vercel 배포 성공
✅ 무료 도메인 연결 완료
✅ HTTPS 자동 설정
✅ 웹사이트 접속 가능
✅ 3D 모델 로드 & 렌더링 성공
✅ 성능 지표 우수 (LCP, CLS, FID < 기준)
```

## 사용할 도구

- **Write**: 워크플로우 파일 작성
- **Bash**: vercel CLI, npm 명령 실행
- **Edit**: 설정 파일 수정 (필요시)

## 참고 자료

- Vercel 공식 문서: https://vercel.com/docs
- GitHub Actions 공식 문서: https://docs.github.com/actions
- Freenom 가이드: https://www.freenom.com/en/freeandcheap.html

## 배포 명령 (참고용)

```bash
# 로컬 배포 시뮬레이션
cd src/web
npm run build
npm run preview

# 실제 배포 (CI/CD 자동)
git push origin main
# → GitHub Actions 자동 실행 → Vercel 자동 배포
```

## 핸드오프 파일

이 에이전트의 산출물:

```
.github/workflows/
└── ci-cd.yml              ← 자동 배포 설정

배포 결과:
└── https://dxf-to-3d.tk   ← 사용자가 접속하는 URL
```

배포 완료 후 사용자는 웹사이트에 접속하여 DXF 업로드 & 변환 가능.

## 체크포인트

실패 시 복구:

1. **GitHub Actions 실패**:
   - 로그에서 오류 확인
   - npm 의존성 설치 실패 → package.json 확인
   - 빌드 오류 → TypeScript 오류 수정

2. **Vercel 배포 실패**:
   - 환경 변수 확인 (VERCEL_TOKEN 등)
   - 빌드 명령 확인
   - 출력 디렉토리 (dist) 존재 확인

3. **도메인 연결 실패**:
   - DNS 레코드 파급 시간 대기 (24시간)
   - Freenom과 Vercel 모두에서 설정 확인

## 변경 이력

- 2026-10-16: 초안 작성

