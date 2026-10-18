// gasiseol.mjs — 가시설(임시 구조물) 도면 설정 & 조립 로직
// 기준: 가시설_평면.dxf, 가시설_단면.dxf, 가시설_상세1~4.dxf

export const gasiseol = {
  drawings: {
    gasiseol: {
      // DXF 파일 경로 및 단위
      dwgPath: 'RAG/가시설_평면.dxf',
      unitMm: 1000,  // 1 DWG unit = 1000 mm (1m)

      // 뷰 설정 (제목 기반 분류)
      titles: {
        views: [
          // 평면도
          {
            kind: 'plan',
            name: '평면도',
            title_h: 0.35,
            description: '전체 배치도'
          },
          // 종단면
          {
            kind: 'long',
            name: '종단면',
            title_h: 0.35,
            description: '길이 방향 단면'
          },
          // 횡단면들
          {
            kind: 'cross',
            name: '횡단면 A-A',
            title_h: 0.35,
            description: '폭 방향 단면'
          },
          {
            kind: 'cross',
            name: '횡단면 B-B',
            title_h: 0.35,
            description: '폭 방향 단면'
          },
          // 상세도
          {
            kind: 'detail',
            name: '상세1',
            title_h: 0.35,
            description: '연결부 상세'
          }
        ]
      },

      // 뷰별 앵커 (좌표 변환)
      anchors: {
        '평면도': {
          u0: 0,           // 가로 기준점
          v0: 0,           // 세로 기준점
          plane: 'XY',     // XY 평면
          unitMm: 1000
        },
        '종단면': {
          u0: 0,
          v0: 0,
          plane: 'XZ',     // XZ 평면 (길이 × 높이)
          unitMm: 1000
        },
        '횡단면 A-A': {
          u0: 0,
          v0: 0,
          plane: 'YZ',     // YZ 평면 (폭 × 높이)
          unitMm: 1000
        },
        '횡단면 B-B': {
          u0: 0,
          v0: 0,
          plane: 'YZ',
          unitMm: 1000
        },
        '상세1': {
          u0: 0,
          v0: 0,
          plane: 'XY',
          unitMm: 1000
        }
      },

      // 뷰 영역 (좌표로 명시)
      viewBoxes: {
        '평면도': {
          plane: 'XY',
          minX: 0,
          maxX: 50000,
          minY: 0,
          maxY: 30000,
          unitMm: 1000
        },
        '종단면': {
          plane: 'XZ',
          minX: 0,
          maxX: 50000,
          minZ: -10000,
          maxZ: 15000,
          unitMm: 1000
        }
      },

      // 기준점 (프로젝트 좌표계)
      datum: {
        mode: 'auto',  // 자동 감지
        u0: { value: 0, hint: '기준선 X 좌표' },
        v0: { value: 0, hint: '기준선 Y 좌표' },
        origin: {
          description: '원점 (모서리 또는 중심)'
        }
      },

      // 부재 조립 함수 (핵심 로직)
      assemble(ir) {
        // ir = Intermediate Representation (중간 표현)
        // → dxf → parse → views → loops → profiles → assemble → IR → egm

        // 예: 가시설 구조
        // 1. 주 구조물 (주각, 보, 연결부)
        // 2. 안전장치 (난간, 발판)
        // 3. 기초/지지부

        try {
          // 평면도에서 폐곡선 추출
          const planLoops = ir.getLoops('평면도');

          // 주요 부재 (가시설은 보통 단순 기하학)
          // 예: 사각형 기둥, 보 등

          // 종단면으로 높이 정보 추출
          const elevLoops = ir.getLoops('종단면');

          // 횡단면으로 폭 정보 추출
          const xsectLoops = ir.getLoops('횡단면 A-A');

          // 3D 조립
          // 평면도 + 높이 → extrude
          // 단면 변화 → loft
          // 연결부 → boolean (union/difference)

          return {
            status: 'success',
            parts: planLoops?.length || 0,
            message: '가시설 3D 모델 조립 완료'
          };

        } catch (error) {
          return {
            status: 'error',
            message: `조립 오류: ${error.message}`,
            hint: '도면의 폐곡선을 확인하세요'
          };
        }
      }
    }
  }
};

// 내보내기 (다른 모듈에서 import 가능)
export default gasiseol;

/*
  사용 예시:

  import { gasiseol } from './gasiseol.mjs';

  // 1. 도면 로드
  const config = gasiseol.drawings.gasiseol;

  // 2. DXF 파싱
  const dwg = parseDrawing(config.dwgPath);

  // 3. 뷰 분리
  const views = extractViews(dwg, config.titles.views);

  // 4. 폐곡선 추출
  const loops = getClosedLoops(views);

  // 5. 프로파일 변환
  const profiles = convertToProfiles(loops, config.anchors);

  // 6. IR 생성
  const ir = createIR(profiles);

  // 7. 조립 (이 함수)
  const result = config.assemble(ir);

  // 8. 3D 생성 (EGModeler)
  const egmCode = generateEGMCommands(ir);

  // 9. 모델러 실행
  executeEGM(egmCode);

  // 10. 검증
  validateVolume(ir, egmOutput);
*/
