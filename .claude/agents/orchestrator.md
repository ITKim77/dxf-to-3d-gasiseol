# Agent: Orchestrator (워크플로우 조율)

## 개요

**이름:** Orchestrator  
**역할:** 4개 에이전트를 조율하여 `/convert` 워크플로우 실행  
**입력:** 도면명 (예: gasiseol)  
**출력:** 완성된 웹사이트 URL + 검증 리포트  
**실행 모드:** 병렬 + 순차 (하이브리드)

## 목표

단계별로 4개 에이전트를 실행하되, 병렬 가능한 부분은 동시에 진행하여 시간을 단축한다.

## 워크플로우 정의

### Stage 1: 초기화 & Research

```
입력: /convert gasiseol

1️⃣ 사전 체크
   - RAG/gasiseol*.dxf 파일 존재 확인
   - 이전 체크포인트 확인
   - PROGRESS.md 상태 확인

2️⃣ Research 에이전트 호출
   명령: dxf-research
   입력: RAG/gasiseol*.dxf
   출력: src/drawings/gasiseol.mjs
   타임아웃: 5분
   오류 시: abort (전체 중단)

3️⃣ 체크포인트 저장
   파일: .claude/artifacts/gasiseol-cp-1.json
   내용: {
     stage: 1,
     status: "success",
     timestamp: "...",
     output: "src/drawings/gasiseol.mjs"
   }
```

### Stage 2: 병렬 실행 (Pipeline + WebUI)

```
[연동 포인트]
Research 완료 후 동시 시작

┌────────────────────┐
│ Pipeline (동시)    │
│ ├─ 입력: gasiseol.mjs
│ ├─ 실행: 8분
│ └─ 출력: out/gasiseol.obj
└────────────────────┘
        ↓
  (모두 완료 대기)
        ↓
┌────────────────────┐
│ WebUI (동시)       │
│ ├─ 입력: out/*.obj  (선택사항)
│ ├─ 실행: 10분
│ └─ 출력: src/web/
└────────────────────┘

실제 Timeline:
  0분: Research 시작
  2분: Research 완료
  2분: Pipeline + WebUI 동시 시작
  10분: WebUI 완료 (먼저 끝남)
  10분: Pipeline 완료
```

### Stage 3: 검증 & Deploy

```
Pipeline 완료 후:

4️⃣ Validation
   - /validate --level=full 실행
   - 부피 오차 < 0.5% 확인
   - 기준값 저장
   
5️⃣ Deploy
   - src/web/ 빌드
   - Vercel 배포
   - URL 생성

6️⃣ 최종 리포트
   - 성공/실패 상태
   - 소요 시간
   - 다운로드 URL
   - 기준값 저장 완료
```

## 구현 (의사 코드)

```javascript
async function orchestrate(drawing) {
  const ctx = {
    drawing,
    startTime: Date.now(),
    checkpoints: {},
    errors: []
  };

  try {
    // ===== Stage 1: Initialize & Research =====
    console.log(`[Stage 1] 초기화 & Research 시작`);
    
    // 사전 체크
    await validateInputFiles(drawing);
    ctx.checkpoints.initialized = Date.now();
    
    // Research 에이전트 호출
    const researchOutput = await runAgent('dxf-research', {
      drawing,
      timeout: '5m'
    });
    
    if (!researchOutput.success) {
      throw new Error(`Research 실패: ${researchOutput.error}`);
    }
    
    // 체크포인트 저장
    saveCheckpoint(1, 'research', researchOutput);
    
    // ===== Stage 2: Parallel (Pipeline + WebUI) =====
    console.log(`[Stage 2] Pipeline + WebUI 병렬 실행`);
    
    // 두 에이전트 동시 실행
    const [pipelineOutput, webuiOutput] = await Promise.all([
      runAgent('pipeline-build', {
        drawing,
        input: researchOutput.output,
        timeout: '10m'
      }),
      runAgent('web-ui-dev', {
        drawing,
        timeout: '10m'
      })
    ]);
    
    // 검증
    if (!pipelineOutput.success) {
      throw new Error(`Pipeline 실패: ${pipelineOutput.error}`);
    }
    
    // 체크포인트 저장
    saveCheckpoint(2, 'pipeline', pipelineOutput);
    
    // ===== Stage 3: Validation & Deploy =====
    console.log(`[Stage 3] 검증 & 배포`);
    
    // 검증
    const validation = await validate(drawing, pipelineOutput);
    if (!validation.pass) {
      throw new Error(`검증 실패: ${validation.errors.join(', ')}`);
    }
    
    // Deploy
    const deployOutput = await runAgent('deploy-ci', {
      drawing,
      webui: webuiOutput.output,
      timeout: '5m'
    });
    
    if (!deployOutput.success) {
      throw new Error(`Deploy 실패: ${deployOutput.error}`);
    }
    
    // ===== Final Report =====
    const elapsed = (Date.now() - ctx.startTime) / 1000;
    
    return {
      success: true,
      url: deployOutput.url,
      elapsedSeconds: elapsed,
      checkpoints: ctx.checkpoints,
      report: {
        drawing,
        stages: ['research', 'pipeline', 'webui', 'deploy'],
        volumes: validation.volumes
      }
    };
    
  } catch (error) {
    ctx.errors.push(error.message);
    
    // 오류 처리
    const recovery = determineRecovery(error);
    
    return {
      success: false,
      error: error.message,
      failedStage: recovery.stage,
      recoveryPath: recovery.path,
      checkpoints: ctx.checkpoints
    };
  }
}
```

## 오류 처리

### 오류 분류 및 복구

```javascript
function determineRecovery(error) {
  if (error.includes('Research')) {
    return {
      stage: 1,
      path: '/step-5',  // Research 재실행
      message: '도면 분석 실패. DXF 파일을 확인하세요.'
    };
  }
  
  if (error.includes('Pipeline')) {
    return {
      stage: 2,
      path: '/convert gasiseol --from-cp-1',  // Pipeline부터 재실행
      message: '3D 생성 실패. assemble() 함수를 확인하세요.'
    };
  }
  
  if (error.includes('Deploy')) {
    return {
      stage: 4,
      path: '/deploy --preview',  // Deploy만 재실행
      message: '배포 실패. Vercel 계정을 확인하세요.'
    };
  }
}
```

## 성능 목표

```
┌──────────────┬────────┬────────────────┐
│ 시나리오     │ 예상시간 │ 병목            │
├──────────────┼────────┼────────────────┤
│ 성공 (최선)  │ 15분   │ Pipeline (8분)  │
│ 성공 (평균)  │ 20분   │ 배포 (4분)      │
│ 오류 + 복구  │ 25분   │ Pipeline 재실행 │
│ 캐시 사용    │ 5분    │ Deploy만        │
└──────────────┴────────┴────────────────┘
```

## 체크포인트 활용

```
--from-cp-1  # Research 완료 상태에서 시작 (Pipeline부터)
--from-cp-2  # Pipeline 완료 상태에서 시작 (WebUI부터)
--from-cp-3  # WebUI 완료 상태에서 시작 (Deploy부터)
```

## 모니터링 & 로깅

```
각 Stage 완료 시:
  ├─ 타임스탬프
  ├─ 소요 시간
  ├─ 출력 파일 경로
  ├─ 부피/검증 수치
  └─ 다음 단계 예고

오류 발생 시:
  ├─ 오류 메시지
  ├─ 스택 트레이스
  ├─ 저장된 체크포인트
  └─ 복구 명령어
```

## 변경 이력

- 2026-10-19: 초안 작성 (단계 8)

