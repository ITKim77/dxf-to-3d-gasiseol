# 부재 자동 식별 솔루션

## 문제
레이어 내에서 **부재들이 섞여있음** (선 길이, 좌표로만 구분 가능)

## 해결 방법: 3단계 클러스터링

### Stage 1: 선 길이 패턴 매칭

**A-GUJO01 분석**:
```
반복되는 길이 패턴 감지:
  [1100, 141, 160, 160, 1300] × 2 = 부재 A, B
  [2180, 2180, 1660, 2180, 2180] = 부재 C
  [5918] = 부재 D (연결부)
  [기타] = 보강선/기호

알고리즘:
  1. 모든 선의 길이를 배열로 수집
  2. 길이 패턴의 GCD(최대공약수) 계산
  3. 주기성 감지
  4. 각 주기 = 1 부재
```

**구현**:
```javascript
function detectPatterns(lines) {
  const lengths = lines.map(l => l.length);
  
  // 주기 탐지 (길이 패턴의 반복)
  const patterns = [];
  let i = 0;
  while (i < lengths.length) {
    // 같은 길이의 연속 선들
    const group = [lengths[i]];
    let j = i + 1;
    while (j < lengths.length && Math.abs(lengths[j] - lengths[j-1]) < 100) {
      group.push(lengths[j]);
      j++;
    }
    
    if (group.length >= 4) { // 최소 4변
      patterns.push({
        lengths: group,
        startIdx: i,
        endIdx: j,
        perimeter: group.reduce((a, b) => a + b)
      });
    }
    i = j;
  }
  
  return patterns;
}
```

### Stage 2: 공간 클러스터링 (DBSCAN)

**알고리즘**:
```
각 선을 점으로 취급 (중점 좌표)
근처 선들 (500mm 이내) = 같은 부재
```

**구현**:
```javascript
function clusterByDistance(lines, eps = 500) {
  const points = lines.map((l, idx) => ({
    idx,
    x: (l.x1 + l.x2) / 2,
    y: (l.y1 + l.y2) / 2,
    line: l
  }));
  
  const clusters = [];
  const visited = new Set();
  
  for (const point of points) {
    if (visited.has(point.idx)) continue;
    
    // 이 점의 이웃 찾기
    const neighbors = points.filter(p => {
      const dist = Math.sqrt(
        Math.pow(p.x - point.x, 2) + 
        Math.pow(p.y - point.y, 2)
      );
      return dist < eps;
    });
    
    if (neighbors.length >= 3) { // 최소 3개 선
      const cluster = neighbors.map(n => n.idx);
      clusters.push(cluster);
      cluster.forEach(idx => visited.add(idx));
    }
  }
  
  return clusters;
}
```

### Stage 3: 부재 속성 추출

**각 클러스터에서 추출할 정보**:
```javascript
{
  id: "GUJO01_001",
  type: "H-Beam", // 또는 "Strut"
  
  // 기하학
  bounds: { minX, maxX, minY, maxY },
  dimensions: { width, height, length },
  
  // 규격 (텍스트 또는 추론)
  spec: "H-300×300×5918", // 최대 길이
  
  // 부피
  volume: width * height * length / 1e6
}
```

---

## 구현 순서

### 1️⃣ **A-GUJO01 부재 자동 식별** (우선순위 1)
```
45개 선 → 5개 클러스터 → 5개 부재
```

**코드**:
```javascript
// src/core/cluster-members.mjs

export function clusterLines(lines, method = 'distance') {
  if (method === 'pattern') {
    return clusterByPattern(lines);
  } else {
    return clusterByDistance(lines, 500);
  }
}

function clusterByPattern(lines) {
  // 길이 패턴 매칭
  const lengths = lines.map(l => l.length);
  
  // 반복되는 패턴 찾기
  const patterns = [];
  // ... 구현
  return patterns.map(p => ({
    lines: lines.slice(p.startIdx, p.endIdx),
    type: 'Member'
  }));
}

function clusterByDistance(lines, eps) {
  // DBSCAN 클러스터링
  // ... 구현
}
```

### 2️⃣ **A-BASE 파일 배치 분석** (우선순위 2)
```
213개 선 → 4개 파일 그룹 → 각 그룹 ~20개 파일
```

### 3️⃣ **A-LINE01 토류판 필터링** (우선순위 3)
```
291개 폴리라인 → 면적 기준 재필터링 → 270개 패널
```

---

## 예상 결과

```
부재 자동 식별 후:
  ✓ A-GUJO01: 5개 부재
  ✓ A-BASE: 4그룹 × 20파일 = 80개 파일
  ✓ A-LINE01: 270개 토류판
  ✓ A-CEN01: 3개 센터 부재
  ✓ A-SLOPE: 20개 사면 구조

총 부재: ~380개
총 부피: ~600,000 m³
```

---

## 테스트 계획

```javascript
// 테스트 케이스
const testResult = clusterLines(gujoLines, 'distance');

console.log(`부재 개수: ${testResult.length}`);
testResult.forEach((cluster, i) => {
  console.log(`부재 ${i}: ${cluster.lines.length}개 선, 부피 ${cluster.volume}m³`);
});
```

---

## 다음 단계

1. **clustering-members.mjs** 구현
2. 각 방법별 테스트 및 비교
3. 정확도 > 95% 달성 시 본격 적용
4. 최종 3D 모델 생성
