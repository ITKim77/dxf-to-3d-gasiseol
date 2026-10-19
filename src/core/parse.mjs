/**
 * parse.mjs - DXF 파일 파싱
 *
 * 역할: DXF 파일을 읽고 구조화된 엔티티 추출
 * 도면 고유값 없음 (절대 금지)
 * 설정은 drawings/*.mjs 에서 제공
 */

import * as fs from 'fs';
import DxfParser from 'dxf-parser';

export async function parseDXF(filePath) {
  console.log(`[parse] ${filePath} 파싱 중...`);

  try {
    // DXF 파일 읽기
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // dxf-parser로 파싱
    const parser = new DxfParser();
    const dxf = parser.parse(fileContent);

    console.log(`[parse] ✓ DXF 로드 성공`);
    console.log(`[parse]   엔티티 수: ${dxf.entities?.length || 0}`);

    // 엔티티 분류
    const entities = {
      lines: [],
      polylines: [],
      circles: [],
      arcs: [],
      texts: [],
      blocks: [],
      layers: {}
    };

    if (dxf.entities) {
      for (const entity of dxf.entities) {
        // 레이어별 분류
        const layer = entity.layer || '0';
        if (!entities.layers[layer]) {
          entities.layers[layer] = [];
        }
        entities.layers[layer].push(entity);

        // 타입별 분류
        switch (entity.type) {
          case 'LINE':
            entities.lines.push(entity);
            break;
          case 'LWPOLYLINE':
          case 'POLYLINE':
            entities.polylines.push(entity);
            break;
          case 'CIRCLE':
            entities.circles.push(entity);
            break;
          case 'ARC':
            entities.arcs.push(entity);
            break;
          case 'TEXT':
          case 'MTEXT':
            entities.texts.push(entity);
            break;
        }
      }
    }

    console.log(`[parse] ✓ 엔티티 추출`);
    console.log(`[parse]   선: ${entities.lines.length}`);
    console.log(`[parse]   폴리라인: ${entities.polylines.length}`);
    console.log(`[parse]   원: ${entities.circles.length}`);
    console.log(`[parse]   호: ${entities.arcs.length}`);
    console.log(`[parse]   텍스트: ${entities.texts.length}`);
    console.log(`[parse]   레이어: ${Object.keys(entities.layers).length}`);

    // 경계 계산
    const bounds = calculateBounds(dxf.entities);
    console.log(`[parse] ✓ 좌표 범위`);
    console.log(`[parse]   X: ${bounds.minX.toFixed(0)} ~ ${bounds.maxX.toFixed(0)}`);
    console.log(`[parse]   Y: ${bounds.minY.toFixed(0)} ~ ${bounds.maxY.toFixed(0)}`);

    // 레이어 정보 분석
    const layerInfo = {};
    for (const [layer, ents] of Object.entries(entities.layers)) {
      layerInfo[layer] = ents;
    }

    return {
      header: dxf.header,
      entities,
      bounds,
      blockRecords: dxf.blockRecords || [],
      layers: dxf.layers || [],
      layerInfo,
      analysis: {
        totalLayers: Object.keys(entities.layers).length,
        majorLayers: Object.keys(entities.layers)
          .sort((a, b) => (entities.layers[b]?.length || 0) - (entities.layers[a]?.length || 0))
          .slice(0, 5)
      }
    };

  } catch (error) {
    console.error(`[parse] ❌ 오류: ${error.message}`);
    throw error;
  }
}

// 좌표 범위 계산
function calculateBounds(entities) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  if (!entities) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };

  for (const entity of entities) {
    try {
      if (entity.type === 'LINE' && entity.startPoint && entity.endPoint) {
        minX = Math.min(minX, entity.startPoint.x || 0, entity.endPoint.x || 0);
        maxX = Math.max(maxX, entity.startPoint.x || 0, entity.endPoint.x || 0);
        minY = Math.min(minY, entity.startPoint.y || 0, entity.endPoint.y || 0);
        maxY = Math.max(maxY, entity.startPoint.y || 0, entity.endPoint.y || 0);
      } else if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.vertices) {
        for (const v of entity.vertices) {
          if (v && typeof v.x === 'number' && typeof v.y === 'number') {
            minX = Math.min(minX, v.x);
            maxX = Math.max(maxX, v.x);
            minY = Math.min(minY, v.y);
            maxY = Math.max(maxY, v.y);
          }
        }
      } else if (entity.type === 'CIRCLE' && entity.center && entity.radius) {
        const r = entity.radius;
        minX = Math.min(minX, (entity.center.x || 0) - r);
        maxX = Math.max(maxX, (entity.center.x || 0) + r);
        minY = Math.min(minY, (entity.center.y || 0) - r);
        maxY = Math.max(maxY, (entity.center.y || 0) + r);
      }
    } catch (e) {
      // 엔티티 처리 중 오류 무시
    }
  }

  // 무한대 처리
  if (!isFinite(minX)) minX = 0;
  if (!isFinite(maxX)) maxX = 100;
  if (!isFinite(minY)) minY = 0;
  if (!isFinite(maxY)) maxY = 100;

  return { minX, maxX, minY, maxY };
}

// 폐곡선 추출 (간단한 버전)
export function extractClosedLoops(entities) {
  const loops = [];

  // 폴리라인 중 닫힌 것들 찾기
  for (const entity of entities.polylines) {
    if (entity.vertices && entity.vertices.length >= 3) {
      // 닫혀있는지 확인
      const first = entity.vertices[0];
      const last = entity.vertices[entity.vertices.length - 1];

      const isClosed = entity.shape === true ||
        (Math.abs(first.x - last.x) < 0.01 && Math.abs(first.y - last.y) < 0.01);

      if (isClosed) {
        loops.push({
          type: 'polyline',
          vertices: entity.vertices.map(v => ({ x: v.x, y: v.y })),
          layer: entity.layer,
          isClosed: true
        });
      }
    }
  }

  console.log(`[parse] ✓ 폐곡선: ${loops.length}개`);
  return loops;
}

// 텍스트에서 치수 추출
export function extractDimensions(entities) {
  const dims = {};

  for (const text of entities.texts) {
    const content = text.text || text.textContent || '';
    const match = content.match(/(\d+(?:\.\d+)?)\s*[mM]?/);

    if (match) {
      dims[text.layer] = {
        value: parseFloat(match[1]),
        text: content,
        position: text.startPoint || text.position
      };
    }
  }

  return dims;
}
