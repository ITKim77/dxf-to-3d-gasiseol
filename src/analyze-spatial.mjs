#!/usr/bin/env node
/**
 * analyze-spatial.mjs - 공간적 클러스터링으로 부재 식별
 *
 * 접근법: 레이어가 혼잡하면 좌표 기반으로 부재를 그룹화
 */

import DxfParser from 'dxf-parser';
import fs from 'fs';

const dxfContent = fs.readFileSync('RAG/가시설_평면.dxf', 'utf-8');
const parser = new DxfParser();
const dxf = parser.parse(dxfContent);

console.log('=== 공간적 클러스터링 분석 ===\n');

// 1. 모든 엔티티의 좌표 범위 추출
const allEntities = [];
dxf.entities.forEach((e, idx) => {
  let x, y;

  if (e.type === 'CIRCLE') {
    x = e.center?.x;
    y = e.center?.y;
  } else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
    if (e.vertices && e.vertices.length > 0) {
      x = e.vertices[0].x;
      y = e.vertices[0].y;
    }
  } else if (e.type === 'LINE') {
    if (e.vertices && e.vertices.length > 0) {
      x = e.vertices[0].x;
      y = e.vertices[0].y;
    }
  } else if (e.type === 'TEXT' || e.type === 'MTEXT') {
    x = e.position?.x;
    y = e.position?.y;
  }

  if (x !== undefined && y !== undefined) {
    allEntities.push({
      idx,
      type: e.type,
      layer: e.layer,
      x: x * 200,
      y: y * 200,
      text: e.text || ''
    });
  }
});

console.log(`총 엔티티: ${allEntities.length}개\n`);

// 2. 좌표 범위 계산
let minX = Infinity, maxX = -Infinity;
let minY = Infinity, maxY = -Infinity;

allEntities.forEach(e => {
  minX = Math.min(minX, e.x);
  maxX = Math.max(maxX, e.x);
  minY = Math.min(minY, e.y);
  maxY = Math.max(maxY, e.y);
});

console.log('전체 좌표 범위:');
console.log(`  X: ${minX.toFixed(0)} ~ ${maxX.toFixed(0)} (폭: ${(maxX - minX).toFixed(0)}mm)`);
console.log(`  Y: ${minY.toFixed(0)} ~ ${maxY.toFixed(0)} (높이: ${(maxY - minY).toFixed(0)}mm)\n`);

// 3. 그리드 영역 분할
const gridCellWidth = (maxX - minX) / 2;
const gridCellHeight = (maxY - minY) / 2;

console.log(`그리드 셀 크기: ${gridCellWidth.toFixed(0)}mm × ${gridCellHeight.toFixed(0)}mm\n`);

// 4. 각 셀에 속한 엔티티 분류
const grid = {};
allEntities.forEach(e => {
  const cellX = Math.floor((e.x - minX) / gridCellWidth);
  const cellY = Math.floor((e.y - minY) / gridCellHeight);
  const cellKey = `[${cellX},${cellY}]`;

  if (!grid[cellKey]) grid[cellKey] = { layers: {}, count: 0, entities: [] };
  grid[cellKey].count++;
  grid[cellKey].entities.push(e);

  const layer = e.layer;
  if (!grid[cellKey].layers[layer]) grid[cellKey].layers[layer] = 0;
  grid[cellKey].layers[layer]++;
});

// 5. 각 셀의 부재 구성 출력
console.log('각 영역별 부재 구성:\n');
Object.entries(grid).sort().forEach(([cellKey, data]) => {
  if (data.count < 5) return; // 5개 이상만

  console.log(`영역 ${cellKey}: 총 ${data.count}개`);
  Object.entries(data.layers)
    .sort((a, b) => b[1] - a[1])
    .forEach(([layer, count]) => {
      console.log(`  ${layer}: ${count}개`);
    });
  console.log();
});

// 6. 텍스트 정보와 근처 엔티티 연결
console.log('\n=== 텍스트 기반 부재 식별 ===\n');

const textsWithCoords = allEntities.filter(e => e.text && e.text.length > 0);
console.log(`총 TEXT 엔티티: ${textsWithCoords.length}개\n`);

textsWithCoords.forEach((textEnt, idx) => {
  if (idx >= 20) return;

  // 이 텍스트 주변 (500mm 이내)의 엔티티 찾기
  const nearby = allEntities.filter(e => {
    if (e.type === 'TEXT' || e.type === 'MTEXT') return false;
    const dist = Math.sqrt(
      Math.pow(e.x - textEnt.x, 2) +
      Math.pow(e.y - textEnt.y, 2)
    );
    return dist < 500; // 500mm 이내
  });

  console.log(`[${idx}] 텍스트: "${textEnt.text}" @ (${textEnt.x.toFixed(0)}, ${textEnt.y.toFixed(0)})`);
  if (nearby.length > 0) {
    console.log(`  주변 엔티티 (${nearby.length}개):`);
    nearby.slice(0, 3).forEach(n => {
      console.log(`    - ${n.type} [${n.layer}] @ (${n.x.toFixed(0)}, ${n.y.toFixed(0)})`);
    });
  }
  console.log();
});

// 7. A-GUJO01 선들의 좌표 클러스터링
console.log('\n=== A-GUJO01 선 클러스터링 (부재 그룹화) ===\n');

const gujoLines = dxf.entities.filter(e => e.layer === 'A-GUJO01' && e.type === 'LINE');
const gujoCoords = gujoLines.map((line, idx) => ({
  idx,
  line,
  x1: line.vertices[0].x * 200,
  y1: line.vertices[0].y * 200,
  x2: line.vertices[1].x * 200,
  y2: line.vertices[1].y * 200,
  length: Math.sqrt(
    Math.pow((line.vertices[1].x - line.vertices[0].x) * 200, 2) +
    Math.pow((line.vertices[1].y - line.vertices[0].y) * 200, 2)
  )
}));

// Y좌표 범위로 그룹화
const gujoGroups = {};
gujoCoords.forEach(coord => {
  const yRange = Math.round(coord.y1 / 500) * 500; // 500mm 단위
  const yKey = `Y${yRange}`;
  if (!gujoGroups[yKey]) gujoGroups[yKey] = [];
  gujoGroups[yKey].push(coord);
});

console.log(`총 Y 그룹: ${Object.keys(gujoGroups).length}개\n`);

Object.entries(gujoGroups).sort().forEach(([yKey, lines]) => {
  console.log(`${yKey}: ${lines.length}개 선`);
  const lengths = lines.map(l => l.length.toFixed(0)).join(', ');
  console.log(`  길이: ${lengths}`);
});

// 8. 결과 저장
const result = {
  timestamp: new Date().toISOString(),
  totalEntities: allEntities.length,
  coordinateRange: {
    x: { min: minX, max: maxX, range: maxX - minX },
    y: { min: minY, max: maxY, range: maxY - minY }
  },
  gridAnalysis: Object.fromEntries(
    Object.entries(grid).map(([key, data]) => [
      key,
      { count: data.count, layers: data.layers }
    ])
  ),
  gujoAnalysis: Object.fromEntries(
    Object.entries(gujoGroups).map(([key, lines]) => [
      key,
      {
        count: lines.length,
        lengths: lines.map(l => l.length.toFixed(0))
      }
    ])
  )
};

fs.writeFileSync('out/spatial-analysis.json', JSON.stringify(result, null, 2));
console.log('\n✓ 분석 결과: out/spatial-analysis.json');
