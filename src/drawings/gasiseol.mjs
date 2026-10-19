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
        // 실제 도면 분석 결과:
        // A-GUJO01 레이어: 구조 부재 (H빔, 기둥 등)
        // A-BASE 레이어: 기초 (원형, 사각형 기초)
        // A-TEXT03: 규격 정보 (H-300X300X10X15 등)

        try {
          const parts = [];

          // 1. A-GUJO01 레이어 = 구조 부재
          if (ir.dxf?.layerInfo?.['A-GUJO01']) {
            const structLines = ir.dxf.layerInfo['A-GUJO01'];
            // H빔 특성:
            // - 깊이: 300mm
            // - 너비: 300mm
            // - 웹 두께: 10mm
            // - 플랜지 두께: 15mm
            parts.push({
              name: 'H-Beam',
              type: 'structural',
              material: 'Steel',
              spec: 'H-300X300X10X15',
              quantity: structLines?.length || 0,
              position: 'main',
              note: '주 구조 보'
            });
          }

          // 2. A-BASE 레이어 = 기초
          if (ir.dxf?.layerInfo?.['A-BASE']) {
            const baseLines = ir.dxf.layerInfo['A-BASE'];
            const circles = baseLines?.filter(e => e.type === 'CIRCLE') || [];

            if (circles.length > 0) {
              parts.push({
                name: 'Pile',
                type: 'foundation',
                material: 'Concrete',
                diameter: circles[0]?.radius * 2 || 1000,
                quantity: circles.length,
                position: 'underground',
                note: '중앙 기둥 (TYP.)'
              });
            }
          }

          // 3. 규격 추출 (텍스트에서)
          const dimensions = ir.dimensions || {};
          let heightInfo = null;

          for (const [layer, dim] of Object.entries(dimensions)) {
            if (dim.text?.includes('H-')) {
              heightInfo = dim;
              break;
            }
          }

          return {
            status: 'success',
            parts: parts.length,
            details: parts,
            heightInfo,
            message: `${parts.length}개 부재 식별됨 (A-GUJO01: 구조, A-BASE: 기초)`,
            note: '올바른 3D 변환을 위해 각 부재의 규격과 길이를 확인하세요'
          };

        } catch (error) {
          return {
            status: 'error',
            message: `조립 오류: ${error.message}`,
            hint: '레이어 구조를 확인하세요: A-GUJO01(구조), A-BASE(기초)'
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
