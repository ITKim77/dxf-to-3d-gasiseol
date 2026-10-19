/**
 * extract-shapes.mjs - DXF에서 실제 3D 형상 추출 (수정본)
 *
 * 수정사항: dxf-parser에서 LINE은 vertices 배열을 사용
 */

const SCALE = 200; // 도면 축척: S = 1:200

export function extractShapes(ir, dxf) {
  console.log(`[extract-shapes] DXF에서 실제 형상 추출\n`);

  const shapes = {
    panels: [],        // 토류판 (A-LINE01)
    struts: [],        // 버팀목 (A-LINE04)
    hBeams: [],        // H-보 (A-GUJO01)
    centerPiles: [],   // 센터 파일 (A-CEN01)
    foundationPiles: [], // 기초 파일 (A-BASE)
    foundationBeams: [] // 기초 보 (A-BASE)
  };

  const layerInfo = ir.dxf?.layerInfo || {};

  // ===== 1. 토류판 추출 (A-LINE01) =====
  console.log(`[extract-shapes] 토류판 추출 (A-LINE01)\n`);
  extractPanels(shapes.panels, layerInfo['A-LINE01'] || []);

  // ===== 2. 버팀목 추출 (A-LINE04) =====
  console.log(`[extract-shapes] 버팀목 추출 (A-LINE04)\n`);
  extractStruts(shapes.struts, layerInfo['A-LINE04'] || []);

  // ===== 3. H-보 추출 (A-GUJO01) =====
  console.log(`[extract-shapes] H-보 추출 (A-GUJO01)\n`);
  extractHBeams(shapes.hBeams, layerInfo['A-GUJO01'] || []);

  // ===== 4. 센터 파일 추출 (A-CEN01) =====
  console.log(`[extract-shapes] 센터 파일 추출 (A-CEN01)\n`);
  extractCenterPiles(shapes.centerPiles, layerInfo['A-CEN01'] || []);

  // ===== 5. 기초 파일 추출 (A-BASE) =====
  console.log(`[extract-shapes] 기초 파일 추출 (A-BASE)\n`);
  extractFoundationPiles(shapes.foundationPiles, layerInfo['A-BASE'] || []);

  // ===== 6. 기초 보 추출 (A-BASE) =====
  console.log(`[extract-shapes] 기초 보 추출 (A-BASE)\n`);
  extractFoundationBeams(shapes.foundationBeams, layerInfo['A-BASE'] || []);

  // 요약
  console.log(`\n[extract-shapes] ✓ 형상 추출 완료\n`);
  console.log(`  토류판: ${shapes.panels.length}개`);
  console.log(`  버팀목: ${shapes.struts.length}개`);
  console.log(`  H-보: ${shapes.hBeams.length}개`);
  console.log(`  센터 파일: ${shapes.centerPiles.length}개`);
  console.log(`  기초 파일: ${shapes.foundationPiles.length}개`);
  console.log(`  기초 보: ${shapes.foundationBeams.length}개\n`);

  return shapes;
}

// ===== 토류판 추출 =====
function extractPanels(panels, entities) {
  const polylines = entities.filter(e => e.type === 'LWPOLYLINE');
  console.log(`  폴리라인: ${polylines.length}개\n`);

  polylines.forEach((poly, idx) => {
    if (!poly.vertices || poly.vertices.length < 3) return;

    // 경계 좌표 계산
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    poly.vertices.forEach(pt => {
      minX = Math.min(minX, pt.x || 0);
      maxX = Math.max(maxX, pt.x || 0);
      minY = Math.min(minY, pt.y || 0);
      maxY = Math.max(maxY, pt.y || 0);
    });

    // 축척 적용
    const realMinX = minX * SCALE;
    const realMaxX = maxX * SCALE;
    const realMinY = minY * SCALE;
    const realMaxY = maxY * SCALE;

    const width = realMaxX - realMinX;
    const height = realMaxY - realMinY;

    if (width > 100 && height > 100) { // 노이즈 필터 (100mm 이상)
      panels.push({
        id: `PANEL_${idx}`,
        type: 'Retaining-Wall-Panel',
        vertices: poly.vertices.map(v => ({
          x: (v.x || 0) * SCALE,
          y: (v.y || 0) * SCALE,
          z: 0
        })),
        bounds: { minX: realMinX, maxX: realMaxX, minY: realMinY, maxY: realMaxY },
        dimensions: {
          width: Math.round(width),
          height: Math.round(height),
          thickness: 300 // 표준 토류판 두께
        },
        volume: Math.round((width * height * 300) / 1e6) // m³
      });
    }
  });

  if (panels.length > 0) {
    console.log(`  ✓ 추출됨: ${panels.length}개 패널\n`);
    panels.slice(0, 3).forEach((p, i) => {
      console.log(`    [${i}] ${p.dimensions.width}×${p.dimensions.height}mm, 부피: ${p.volume}m³`);
    });
    if (panels.length > 3) console.log(`    ... 외 ${panels.length - 3}개\n`);
  }
}

// ===== 버팀목 추출 =====
function extractStruts(struts, entities) {
  const lines = entities.filter(e => e.type === 'LINE');
  console.log(`  선: ${lines.length}개\n`);

  lines.forEach((line, idx) => {
    const start = line.vertices?.[0] || line.start;
    const end = line.vertices?.[1] || line.end;
    if (!start || !end) return;

    const dx = (end.x - start.x) * SCALE;
    const dy = (end.y - start.y) * SCALE;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length > 500) { // 최소 길이 500mm
      struts.push({
        id: `STRUT_${idx}`,
        type: 'Strut',
        start: {
          x: start.x * SCALE,
          y: start.y * SCALE,
          z: 0
        },
        end: {
          x: end.x * SCALE,
          y: end.y * SCALE,
          z: 0
        },
        length: Math.round(length),
        dimensions: {
          sectionWidth: 200,  // 200×200 각재 (표준)
          sectionHeight: 200,
          length: Math.round(length)
        },
        volume: Math.round((200 * 200 * length) / 1e6)
      });
    }
  });

  if (struts.length > 0) {
    console.log(`  ✓ 추출됨: ${struts.length}개 버팀목\n`);
    struts.slice(0, 3).forEach((s, i) => {
      console.log(`    [${i}] 길이: ${s.length}mm, 부피: ${s.volume}m³`);
    });
    if (struts.length > 3) console.log(`    ... 외 ${struts.length - 3}개\n`);
  }
}

// ===== H-보 추출 =====
function extractHBeams(beams, entities) {
  const lines = entities.filter(e => e.type === 'LINE');
  console.log(`  선: ${lines.length}개\n`);

  // 선들을 Y좌표로 그룹화 (같은 높이 = 같은 보)
  const groups = {};
  lines.forEach(line => {
    const start = line.vertices?.[0] || line.start;
    if (!start) return;
    const yKey = Math.round(start.y / 100) * 100; // 100mm 단위로 그룹화
    if (!groups[yKey]) groups[yKey] = [];
    groups[yKey].push(line);
  });

  let beamIdx = 0;
  for (const [yKey, groupLines] of Object.entries(groups)) {
    if (groupLines.length < 2) continue; // 최소 2개 이상의 선

    // 그룹 내 선들의 길이 통계
    const lengths = groupLines.map(l => {
      const start = l.vertices?.[0] || l.start;
      const end = l.vertices?.[1] || l.end;
      if (!start || !end) return 0;
      return Math.sqrt(
        Math.pow((end.x - start.x) * SCALE, 2) +
        Math.pow((end.y - start.y) * SCALE, 2)
      );
    });
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

    if (avgLength > 1000) { // 최소 길이 1000mm
      const centerY = parseFloat(yKey);
      const centerX = (groupLines.reduce((sum, l) => {
        const start = l.vertices?.[0] || l.start;
        return sum + (start?.x || 0);
      }, 0) / groupLines.length) * SCALE;

      beams.push({
        id: `HBEAM_${beamIdx}`,
        type: 'H-Beam',
        position: { x: centerX, y: centerY * SCALE, z: 3000 },
        dimensions: { width: 300, height: 300, length: Math.round(avgLength) },
        spec: 'H-300×300×10×15',
        lineCount: groupLines.length,
        volume: Math.round((300 * 300 * avgLength) / 1e6)
      });

      beamIdx++;
    }
  }

  if (beams.length > 0) {
    console.log(`  ✓ 추출됨: ${beams.length}개 H-보\n`);
  }
}

// ===== 센터 파일 추출 =====
function extractCenterPiles(piles, entities) {
  const allEntities = entities.filter(e => e.type === 'LINE' || e.type === 'LWPOLYLINE');
  console.log(`  엔티티: ${allEntities.length}개\n`);

  // 센터 파일은 특정 패턴 (수평 또는 수직 배치)
  // 현재는 모두 가로파일로 처리
  allEntities.forEach((entity, idx) => {
    if (entity.type === 'LINE' && entity.vertices && entity.vertices.length >= 2) {
      const start = entity.vertices[0];
      const end = entity.vertices[1];
      const dx = (end.x - start.x) * SCALE;
      const dy = (end.y - start.y) * SCALE;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 500) {
        piles.push({
          id: `CPILE_${idx}`,
          type: 'Center-Pile-H',
          start: { x: start.x * SCALE, y: start.y * SCALE, z: 0 },
          end: { x: end.x * SCALE, y: end.y * SCALE, z: 0 },
          length: Math.round(length),
          spec: 'H-200×200 (추정)',
          volume: Math.round((200 * 200 * length) / 1e6)
        });
      }
    }
  });

  if (piles.length > 0) {
    console.log(`  ✓ 추출됨: ${piles.length}개 센터 파일\n`);
  }
}

// ===== 기초 파일 추출 =====
function extractFoundationPiles(piles, entities) {
  const circles = entities.filter(e => e.type === 'CIRCLE');
  console.log(`  원(파일): ${circles.length}개\n`);

  circles.forEach((circle, idx) => {
    if (!circle.center) return;

    // 실제 파일 직경: 표준값 φ1000 사용 (도면에서는 심볼로 표시)
    const diameter = 1000; // mm
    const radius = diameter / 2;

    piles.push({
      id: `FPILE_${idx}`,
      type: 'Foundation-Pile',
      center: {
        x: circle.center.x * SCALE,
        y: circle.center.y * SCALE,
        z: 0
      },
      diameter: diameter,
      depth: 8000, // 표준 파일 깊이
      radius: radius,
      volume: Math.round(Math.PI * Math.pow(radius, 2) * 8000 / 1e6)
    });
  });

  if (piles.length > 0) {
    console.log(`  ✓ 추출됨: ${piles.length}개 기초 파일 (φ${piles[0].diameter}mm)\n`);
  }
}

// ===== 기초 보 추출 =====
function extractFoundationBeams(beams, entities) {
  const lines = entities.filter(e => e.type === 'LINE');
  const filtered = lines.filter(l => {
    if (!l.vertices || l.vertices.length < 2) return false;
    const start = l.vertices[0];
    const end = l.vertices[1];
    const length = Math.sqrt(
      Math.pow((end.x - start.x) * SCALE, 2) +
      Math.pow((end.y - start.y) * SCALE, 2)
    );
    return length > 2000; // 기초 보는 길이가 2000mm 이상
  });

  console.log(`  기초 보: ${filtered.length}개\n`);

  filtered.forEach((line, idx) => {
    const start = line.vertices[0];
    const end = line.vertices[1];
    const dx = (end.x - start.x) * SCALE;
    const dy = (end.y - start.y) * SCALE;
    const length = Math.sqrt(dx * dx + dy * dy);

    beams.push({
      id: `FBEAM_${idx}`,
      type: 'Foundation-Beam',
      start: { x: start.x * SCALE, y: start.y * SCALE, z: 0 },
      end: { x: end.x * SCALE, y: end.y * SCALE, z: 0 },
      length: Math.round(length),
      section: '250×250',
      volume: Math.round((250 * 250 * length) / 1e6)
    });
  });

  if (beams.length > 0) {
    console.log(`  ✓ 추출됨: ${beams.length}개 기초 보\n`);
  }
}
