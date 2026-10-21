#!/usr/bin/env node
/**
 * verify-v4.mjs - v4 통합모델 검증
 *  1) 부재 수량: 설계 기준과 일치하는지
 *  2) 간섭: H형강은 플랜지 2개 + 웨브로 나눠 검사 (상자 근사보다 정확)
 * 실패 항목이 있으면 종료 코드 1
 */

import fs from 'fs';

const EXPECTED = {
  '엄지말뚝': 122,
  '토류판': 120,
  '띠장': 48,
  '수직 PIECE': 52,
  '버팀보': 26,
  '스크류잭': 26,
  '채널': 12,
  '중간말뚝': 13
};

const d = JSON.parse(fs.readFileSync('out/gasiseol-v4-stats.json', 'utf8'));
const EPS = 1e-3;
let failed = false;

console.log('\n[1] 부재 수량');
const counts = {};
d.parts.forEach(p => { counts[p.memberType] = (counts[p.memberType] || 0) + 1; });
Object.keys({ ...EXPECTED, ...counts }).forEach(type => {
  const exp = EXPECTED[type] ?? 0, got = counts[type] ?? 0;
  const ok = exp === got;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'OK ' : 'NG '} ${type.padEnd(12)} 기대 ${String(exp).padStart(3)}  실제 ${String(got).padStart(3)}`);
});

// 로컬 좌표(u: 폭, v: 춤, a: 길이) → 월드 좌표 축 매핑 (viewer 와 동일)
// vertical: u→x, v→y, a→z / horizontal(rot y π/2): u→z, v→y, a→x / horizontalY(rot x π/2): u→x, v→z, a→y
function hBoxes(p) {
  const { h, w, tf, tw, length: L } = p.dims;
  const local = [
    [-w / 2, w / 2, h / 2 - tf, h / 2],
    [-w / 2, w / 2, -h / 2, -h / 2 + tf],
    [-tw / 2, tw / 2, -h / 2 + tf, h / 2 - tf]
  ];
  return local.map(([u0, u1, v0, v1]) => {
    const a0 = -L / 2, a1 = L / 2;
    if (p.axis === 'horizontal') return { x: [a0, a1], y: [v0, v1], z: [u0, u1] };
    if (p.axis === 'horizontalY') return { x: [u0, u1], y: [a0, a1], z: [v0, v1] };
    return { x: [u0, u1], y: [v0, v1], z: [a0, a1] };
  });
}

function components(p) {
  const { x, y, z } = p.position;
  const shift = (b) => ({ x: [b.x[0] + x, b.x[1] + x], y: [b.y[0] + y, b.y[1] + y], z: [b.z[0] + z, b.z[1] + z] });
  if (p.shape === 'PANEL') {
    const { w, t, length: L } = p.dims;
    return [shift({ x: [-w / 2, w / 2], y: [-t / 2, t / 2], z: [-L / 2, L / 2] })];
  }
  if (p.shape === 'JACK') {
    return [shift({ x: [-0.15, 0.15], y: [-0.29975, 0.29975], z: [-0.1547, 0.1547] })];
  }
  if (p.shape === 'CHANNEL') {
    const { w, h, length: L } = p.dims;
    return [shift({ x: [-L / 2, L / 2], y: [-w / 2, w / 2], z: [-h / 2, h / 2] })];
  }
  return hBoxes(p).map(shift);
}

function overlap(a, b) {
  return ['x', 'y', 'z'].every(k => Math.min(a[k][1], b[k][1]) - Math.max(a[k][0], b[k][0]) > EPS);
}

console.log('\n[2] 간섭 (H형강: 플랜지·웨브 분리 검사)');
const items = d.parts.map((p, i) => ({ i, comps: components(p) }));
const conflicts = {};
for (let a = 0; a < items.length; a++) {
  for (let b = a + 1; b < items.length; b++) {
    const A = items[a], B = items[b];
    const hit = A.comps.some(ca => B.comps.some(cb => overlap(ca, cb)));
    if (hit) {
      const key = `${d.parts[A.i].memberType} ↔ ${d.parts[B.i].memberType}`;
      conflicts[key] = (conflicts[key] || 0) + 1;
    }
  }
}
const keys = Object.keys(conflicts);
if (keys.length === 0) {
  console.log('  OK  간섭 없음');
} else {
  failed = true;
  keys.forEach(k => console.log(`  NG  ${k}: ${conflicts[k]}쌍`));
}

console.log(`\n결과: ${failed ? '실패' : '통과'}`);
process.exit(failed ? 1 : 0);
