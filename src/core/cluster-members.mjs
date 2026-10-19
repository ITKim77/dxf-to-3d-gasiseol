/**
 * cluster-members.mjs - 자동 부재 식별 클러스터링
 *
 * 방법: DBSCAN 거리 기반 + 선 길이 패턴 매칭
 */

const EPS = 600; // 600mm 이내 = 같은 부재

export function clusterMembersFromLines(lines) {
  console.log(`[cluster-members] ${lines.length}개 선 클러스터링\n`);

  if (lines.length === 0) {
    console.log('  ⚠️  선 없음\n');
    return [];
  }

  // 1. 선을 3D 점으로 변환 (중점 + 길이)
  const points = lines.map((line, idx) => {
    if (!line.vertices || line.vertices.length < 2) return null;

    const start = line.vertices[0];
    const end = line.vertices[1];
    const midX = ((start.x + end.x) / 2) * 200;
    const midY = ((start.y + end.y) / 2) * 200;
    const length = Math.sqrt(
      Math.pow((end.x - start.x) * 200, 2) +
      Math.pow((end.y - start.y) * 200, 2)
    );

    return {
      idx,
      x: midX,
      y: midY,
      length: length,
      line: line,
      visited: false,
      clustered: false
    };
  }).filter(p => p !== null);

  console.log(`  변환됨: ${points.length}개 점\n`);

  // 2. DBSCAN 클러스터링
  const clusters = dbscan(points, EPS, 3); // minPts=3

  console.log(`  ✓ 클러스터 감지: ${clusters.length}개\n`);

  // 3. 각 클러스터에서 부재 특성 추출
  const members = clusters.map((clusterIndices, clusterIdx) => {
    const clusterPoints = clusterIndices.map(i => points[i]);
    const clusterLines = clusterPoints.map(p => p.line);

    // 경계 계산
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    clusterPoints.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const avgLength = clusterPoints.reduce((sum, p) => sum + p.length, 0) / clusterPoints.length;

    // 부재 유형 판단
    const lengthVariance = Math.max(...clusterPoints.map(p => p.length)) -
                          Math.min(...clusterPoints.map(p => p.length));

    const isStructuralBeam = clusterLines.length >= 4 && lengthVariance > 500;
    const type = isStructuralBeam ? 'H-Beam' : 'Strut';

    return {
      id: `${type}_${clusterIdx}`,
      type: type,
      clusterSize: clusterLines.length,
      lineIndices: clusterIndices,

      bounds: {
        minX: minX.toFixed(0),
        maxX: maxX.toFixed(0),
        minY: minY.toFixed(0),
        maxY: maxY.toFixed(0)
      },

      dimensions: {
        width: Math.round(width),
        height: Math.round(height),
        length: Math.round(avgLength)
      },

      lineDetails: clusterPoints.map(p => ({
        length: Math.round(p.length),
        x: Math.round(p.x),
        y: Math.round(p.y)
      })),

      spec: type === 'H-Beam' ? 'H-300×300' : '200×200',
      volume: Math.round((300 * 300 * avgLength) / 1e6)
    };
  });

  // 결과 출력
  console.log('클러스터별 부재:');
  members.forEach((m, i) => {
    console.log(`  [${i}] ${m.type}: ${m.clusterSize}개 선, 부피: ${m.volume}m³`);
  });
  console.log();

  return members;
}

// DBSCAN 알고리즘
function dbscan(points, eps, minPts) {
  const clusters = [];
  const visited = new Set();

  for (let i = 0; i < points.length; i++) {
    if (visited.has(i)) continue;

    const neighbors = getNeighbors(points, i, eps);

    if (neighbors.length < minPts) continue; // 노이즈

    // 새 클러스터 시작
    const cluster = new Set([i]);
    visited.add(i);

    // 확장
    const queue = [...neighbors];
    while (queue.length > 0) {
      const nextIdx = queue.shift();

      if (visited.has(nextIdx)) continue;
      visited.add(nextIdx);

      const nextNeighbors = getNeighbors(points, nextIdx, eps);
      if (nextNeighbors.length >= minPts) {
        queue.push(...nextNeighbors.filter(idx => !visited.has(idx)));
      }

      cluster.add(nextIdx);
    }

    if (cluster.size >= minPts) {
      clusters.push(Array.from(cluster));
    }
  }

  return clusters;
}

// 거리 기반 이웃 찾기
function getNeighbors(points, idx, eps) {
  const neighbors = [];
  const point = points[idx];

  for (let i = 0; i < points.length; i++) {
    if (i === idx) continue;

    const other = points[i];
    const dist = Math.sqrt(
      Math.pow(point.x - other.x, 2) +
      Math.pow(point.y - other.y, 2)
    );

    if (dist < eps) {
      neighbors.push(i);
    }
  }

  return neighbors;
}

// 선 길이 패턴 매칭 (보조)
export function detectLengthPatterns(lines) {
  console.log(`[cluster-members] 선 길이 패턴 분석\n`);

  const lengths = lines.map(l => {
    if (!l.vertices || l.vertices.length < 2) return 0;
    const start = l.vertices[0];
    const end = l.vertices[1];
    return Math.sqrt(
      Math.pow((end.x - start.x) * 200, 2) +
      Math.pow((end.y - start.y) * 200, 2)
    );
  });

  // 길이별 그룹화
  const grouped = {};
  lengths.forEach((len, idx) => {
    const key = Math.round(len / 100) * 100; // 100mm 단위
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ idx, length: len });
  });

  console.log('길이 분포:');
  Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .forEach(([key, items]) => {
      console.log(`  ${key}mm: ${items.length}개`);
    });
  console.log();

  return grouped;
}
