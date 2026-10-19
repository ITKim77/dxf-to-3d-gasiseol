/**
 * analyze-geometry.mjs - 부재의 실제 기하학 분석 (LOD 300)
 *
 * 목표: 도면의 선/폐곡선에서 부재의 정확한 3D 형상 추출
 * - 폐곡선 감지 (선들의 연결 분석)
 * - 단면 형상 파악 (H-빔, 판재, 원 등)
 * - 3D 돌출 (Extrude) 생성
 */

export function analyzeGeometry(layer, entities) {
  console.log(`\n[analyze-geometry] ${layer} 부재 기하학 분석\n`);

  const lines = entities.filter(e => e.type === 'LINE');
  const polys = entities.filter(e => e.type === 'LWPOLYLINE');
  const circles = entities.filter(e => e.type === 'CIRCLE');

  // 1. 폐곡선 감지
  const closedLoops = detectClosedLoops(lines);
  console.log(`  폐곡선: ${closedLoops.length}개 감지`);

  // 2. 단면 형상 분석
  const shapes = analyzeShapes(closedLoops, polys, circles);
  console.log(`  단면 형상: ${shapes.length}개`);

  // 3. 부재 생성
  const members = shapes.map((shape, idx) => ({
    id: `${layer}_${idx}`,
    layer: layer,
    shape: shape,
    lod: 300,
    geometry: generateGeometry(shape)
  }));

  return members;
}

// 폐곡선 감지 (선들의 연결 분석)
function detectClosedLoops(lines) {
  console.log(`\n  [폐곡선 감지] ${lines.length}개 선에서...`);

  if (lines.length === 0) return [];

  // 좌표를 점으로 변환 (정수 좌표)
  const points = new Map();
  const edges = [];

  lines.forEach(line => {
    if (!line.vertices || line.vertices.length < 2) return;

    const start = roundCoord(line.vertices[0]);
    const end = roundCoord(line.vertices[1]);

    const key1 = `${start.x},${start.y}`;
    const key2 = `${end.x},${end.y}`;

    points.set(key1, start);
    points.set(key2, end);

    edges.push({ start: key1, end: key2, line: line });
  });

  // 폐곡선 추출 (순환 경로 찾기)
  const loops = [];
  const visited = new Set();

  for (const edge of edges) {
    if (visited.has(`${edge.start}-${edge.end}`)) continue;

    const loop = traceLoop(edge.start, edge.end, edges, visited, points);
    if (loop && loop.length >= 3) {
      loops.push(loop);
    }
  }

  console.log(`    ✓ ${loops.length}개 폐곡선 추출됨`);
  return loops;
}

// 순환 경로 추적
function traceLoop(start, current, edges, visited, points) {
  const loop = [points.get(start)];
  let next = current;

  for (let i = 0; i < edges.length + 10; i++) {
    if (next === start && loop.length >= 3) {
      // 폐곡선 완성
      return loop;
    }

    // 다음 연결 선 찾기
    const nextEdge = edges.find(e =>
      e.start === next &&
      !visited.has(`${e.start}-${e.end}`)
    );

    if (!nextEdge) break;

    visited.add(`${nextEdge.start}-${nextEdge.end}`);
    loop.push(points.get(nextEdge.end));
    next = nextEdge.end;
  }

  return loop.length >= 3 ? loop : null;
}

// 좌표 반올림 (오차 보정)
function roundCoord(coord, precision = 100) {
  return {
    x: Math.round((coord.x || 0) / precision) * precision,
    y: Math.round((coord.y || 0) / precision) * precision,
    z: coord.z || 0
  };
}

// 단면 형상 분석
function analyzeShapes(loops, polys, circles) {
  const shapes = [];

  // 1. 폐곡선에서 형상 추출
  loops.forEach((loop, idx) => {
    const shape = classifyShape(loop);
    shapes.push({
      id: `loop_${idx}`,
      type: shape.type,
      vertices: loop,
      bounds: calculateBounds(loop),
      area: calculatePolygonArea(loop),
      perimeter: calculatePerimeter(loop)
    });
  });

  // 2. 폴리라인에서 형상 추출
  polys.forEach((poly, idx) => {
    if (poly.vertices && poly.vertices.length >= 3) {
      const verts = poly.vertices.map(v => ({
        x: v.x,
        y: v.y,
        z: v.z || 0
      }));

      shapes.push({
        id: `poly_${idx}`,
        type: 'Polyline',
        vertices: verts,
        bounds: calculateBounds(verts),
        area: calculatePolygonArea(verts),
        perimeter: calculatePerimeter(verts),
        closed: isClosedLoop(verts)
      });
    }
  });

  // 3. 원에서 형상 추출
  circles.forEach((circle, idx) => {
    if (circle.center) {
      shapes.push({
        id: `circle_${idx}`,
        type: 'Circle',
        center: circle.center,
        radius: circle.radius,
        area: Math.PI * circle.radius * circle.radius,
        perimeter: 2 * Math.PI * circle.radius
      });
    }
  });

  console.log(`    ✓ 루프: ${loops.length}, 폴리라인: ${polys.length}, 원: ${circles.length}`);
  return shapes;
}

// 형상 분류
function classifyShape(vertices) {
  if (vertices.length === 4) {
    return { type: 'Rectangle' };
  } else if (vertices.length === 3) {
    return { type: 'Triangle' };
  } else {
    return { type: 'Polygon' };
  }
}

// 경계 계산
function calculateBounds(vertices) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  vertices.forEach(v => {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  });

  return {
    minX, maxX, minY, maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

// 다각형 면적 계산 (Shoelace formula)
function calculatePolygonArea(vertices) {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area / 2);
}

// 둘레 계산
function calculatePerimeter(vertices) {
  let perimeter = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const dx = vertices[j].x - vertices[i].x;
    const dy = vertices[j].y - vertices[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

// 폐곡선 확인
function isClosedLoop(vertices) {
  if (vertices.length < 3) return false;
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  const dist = Math.sqrt(
    Math.pow(last.x - first.x, 2) +
    Math.pow(last.y - first.y, 2)
  );
  return dist < 10; // 10mm 이내
}

// 3D 기하학 생성 (LOD 300)
function generateGeometry(shape) {
  return {
    type: shape.type,
    vertices: shape.vertices,
    bounds: shape.bounds,
    properties: {
      area: shape.area,
      perimeter: shape.perimeter,
      closed: shape.closed,
      lod: 300
    }
  };
}

// 부재 타입 판정 (형상 기반)
export function identifyMemberType(shape) {
  const { bounds, area, perimeter } = shape;

  // H-빔: 정사각형 또는 직사각형 (가로:세로 비율 1~3)
  const aspectRatio = bounds.width / bounds.height;
  if (aspectRatio > 0.5 && aspectRatio < 2 && area > 1000) {
    return 'H-Beam';
  }

  // 판재: 세로가 긴 직사각형 (가로:세로 > 3)
  if (aspectRatio < 0.33 && area > 500) {
    return 'Panel';
  }

  // 버팀목: 가로가 긴 직사각형
  if (aspectRatio > 3 && area > 500) {
    return 'Strut';
  }

  // 기초파일: 원형
  if (shape.type === 'Circle') {
    return 'Foundation-Pile';
  }

  return 'Unknown';
}
