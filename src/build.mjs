#!/usr/bin/env node
/**
 * build.mjs - IR (중간 표현) 생성
 *
 * DXF → IR (JSON) 변환
 * IR은 렌더러와 무관한 중간 형식
 *
 * 사용: node src/build.mjs <drawing-name>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseDXF, extractClosedLoops, extractDimensions } from './core/parse.mjs';
import { gasiseol } from './drawings/gasiseol.mjs';

async function buildIR(drawingName) {
  console.log(`[build] ${drawingName} IR 생성 시작...\n`);

  try {
    // 1. 설정 파일 로드
    let config = gasiseol.drawings[drawingName];
    if (!config) {
      throw new Error(`설정 파일 없음: drawings/${drawingName}.mjs`);
    }
    console.log(`[build] ✓ 설정 파일 로드: ${drawingName}`);

    // 2. DXF 파일 파싱
    const dwgPath = config.dwgPath;
    if (!fs.existsSync(dwgPath)) {
      throw new Error(`DXF 파일 없음: ${dwgPath}`);
    }

    const dxf = await parseDXF(dwgPath);
    console.log();

    // 3. 폐곡선 추출
    console.log(`[build] 폐곡선 추출 중...\n`);
    const closedLoops = extractClosedLoops(dxf.entities);

    // 4. 뷰 분리 (텍스트 기반)
    const views = {};
    for (const viewDef of config.titles.views) {
      const viewName = viewDef.name;
      const viewLoops = closedLoops.filter(loop =>
        dxf.entities.layers[viewName]?.some(e =>
          JSON.stringify(e.vertices) === JSON.stringify(loop.vertices)
        )
      );

      if (viewLoops.length === 0 && closedLoops.length > 0) {
        // 첫 번째 폐곡선을 현재 뷰에 할당 (단순화)
        viewLoops.push(closedLoops[0]);
      }

      views[viewName] = {
        kind: viewDef.kind,
        description: viewDef.description,
        loops: viewLoops,
        anchor: config.anchors[viewName] || config.anchors[Object.keys(config.anchors)[0]],
        bounds: config.viewBoxes[viewName]
      };

      console.log(`  ✓ ${viewName.padEnd(12)} ${viewLoops.length}개 루프`);
    }
    console.log();

    // 5. 치수 추출
    console.log(`[build] 치수 추출 중...\n`);
    const dimensions = extractDimensions(dxf.entities);
    for (const [layer, dim] of Object.entries(dimensions)) {
      console.log(`  ✓ ${layer.padEnd(12)} ${dim.value} ${dim.text}`);
    }

    // 6. IR 객체 생성
    const ir = {
      metadata: {
        timestamp: new Date().toISOString(),
        drawing: drawingName,
        source: dwgPath,
        version: '1.0',
        status: 'parsed'
      },
      config,
      dxf: {
        header: dxf.header,
        bounds: dxf.bounds,
        layerCount: Object.keys(dxf.layers).length,
        entityCount: dxf.entities.lines.length +
                     dxf.entities.polylines.length +
                     dxf.entities.circles.length
      },
      views,
      dimensions,
      closedLoops,

      // 헬퍼 메서드
      getLoops(viewName) {
        return views[viewName]?.loops || [];
      },
      getAnchor(viewName) {
        return views[viewName]?.anchor;
      },
      getViewBounds(viewName) {
        return views[viewName]?.bounds;
      }
    };

    console.log(`\n[build] ✓ IR 객체 생성\n`);

    // 7. IR 파일 저장
    const outDir = 'out';
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const irPath = path.join(outDir, `${drawingName}.ir.json`);
    fs.writeFileSync(irPath, JSON.stringify(ir, null, 2), 'utf-8');

    const fileSize = fs.statSync(irPath).size;
    console.log(`[build] ✓ IR 파일 저장: ${irPath}`);
    console.log(`[build]   크기: ${(fileSize / 1024).toFixed(1)} KB`);
    console.log(`[build]   뷰: ${Object.keys(views).length}개`);
    console.log(`[build]   루프: ${closedLoops.length}개`);
    console.log(`[build] ✅ 완료!\n`);

    return ir;

  } catch (error) {
    console.error(`[build] ❌ 오류: ${error.message}`);
    process.exit(1);
  }
}

// CLI 실행
const drawingName = process.argv[2] || 'gasiseol';
await buildIR(drawingName);
