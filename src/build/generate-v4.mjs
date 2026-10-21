#!/usr/bin/env node
/**
 * generate-v4.mjs - 평면도 기준 통합 모델 (엄지말뚝 2열 기준 재배치)
 *
 * 기준 (사용자 제공):
 *  - 엄지말뚝 상단 열 A 시작점 (-1248.4329, -2617.9386), 하단 열 B 시작점 (-1248.4329, -2631.1386)
 *  - 각 열은 X 방향 1m 간격 61개 (엄지말뚝 h-pile2), 열 사이 Y 13.2m
 *  - 토류판은 같은 열의 엄지말뚝 사이에만 60개씩 배치
 *
 * 나머지 부재 (가시설4, H-PILE, 스터럿): 계획도 데이터에서 말뚝 열 4개 중 상단/하단 열과의
 *  상대 위치(Δx, Δy)를 유지해 A/B 열 기준으로 재배치.
 */

import DxfParser from 'dxf-parser';
import fs from 'fs';

const MEMBERS = {
  'h-pile2': { memberType: '엄지말뚝', spec: 'H400×400×13/21', shape: 'H', h: 0.40, w: 0.40, tf: 0.021, tw: 0.013, length: 8.5, axis: 'vertical' },
  '띠장':     { memberType: '띠장', spec: 'H300×300×10/15', shape: 'H', h: 0.30, w: 0.30, tf: 0.015, tw: 0.010, length: 60, axis: 'horizontal' },
  '토류판':   { memberType: '토류판', spec: 'T=100 (0.9×0.1)', shape: 'PANEL', w: 0.90, t: 0.10, length: 8.5, axis: 'vertical' },
  'H-PILE':   { memberType: '중간말뚝', spec: 'H300×300×10/15', shape: 'H', h: 0.30, w: 0.30, tf: 0.015, tw: 0.010, length: 8.5, axis: 'vertical' },
  '가시설4':  { memberType: '수직 H300 (미확정)', spec: 'H300×300×10/15', shape: 'H', h: 0.30, w: 0.30, tf: 0.015, tw: 0.010, length: 8.5, axis: 'vertical' },
  '스터럿':   { memberType: '버팀보', spec: 'H300×300×10/15', shape: 'H', h: 0.30, w: 0.30, tf: 0.015, tw: 0.010, length: 12.8, axis: 'horizontal' },
  '수직PIECE': { memberType: '수직 PIECE', spec: 'H300×300×10/15', shape: 'H', h: 0.30, w: 0.30, tf: 0.015, tw: 0.010, length: 0.6, axis: 'vertical' },
  '스크류잭': { memberType: '스크류잭', spec: '1000kN', shape: 'JACK', h: 0.309, w: 0.30, length: 0.5995, axis: 'jackY' },
  '채널': { memberType: '채널', spec: 'ㄷ-380×100×10.5/16', shape: 'CHANNEL', h: 0.38, w: 0.10, tf: 0.016, tw: 0.0105, length: 1, axis: 'channelX' },
  '버팀보Y':   { memberType: '버팀보', spec: 'H300×300×10/15', shape: 'H', h: 0.30, w: 0.30, tf: 0.015, tw: 0.010, length: 12.2, axis: 'horizontalY' }
};

const ROW_A = { x: -1248.4329, y: -2617.9386 };
const ROW_B = { x: -1248.4329, y: -2631.1386 };
const PILES_PER_ROW = 61;
const SPACING = 1.0;

// A-A 단면: 엄지말뚝 상단 EL 77.97, 하단 EL 69.47 (L=8.5). 띠장 2단 EL 77.1, 74.9
const PILE_LENGTH = 8.5;
const PILE_CENTER_Z = 77.97 - PILE_LENGTH / 2;
const WALE_LEVELS = [77.1, 74.9];
const WALE_LENGTH = (PILES_PER_ROW - 1) * SPACING;
const PILE_HALF = 0.2;
const WALE_HALF = 0.15;
const PANEL_HALF = 0.05;
const FLANGE_T = 0.021;

const plan = new DxfParser().parse(fs.readFileSync('RAG/LH/가시설계획_LH.dxf', 'utf-8'));
const inserts = plan.entities.filter(e => e.type === 'INSERT' && MEMBERS[e.name]);

const parts = [];
const pushPart = (blockName, pos) => {
  const m = MEMBERS[blockName];
  parts.push({
    blockType: blockName,
    memberType: m.memberType,
    spec: m.spec,
    shape: m.shape,
    dims: { h: m.h, w: m.w, tf: m.tf, tw: m.tw, t: m.t, length: pos.length ?? m.length },
    axis: m.axis,
    position: { x: +pos.x.toFixed(4), y: +pos.y.toFixed(4), z: +(pos.z ?? PILE_CENTER_Z).toFixed(4) }
  });
};

// A-A 단면: 벽체 방향 X 구간별 말뚝 상단 표고 (0.3m 단위 6그룹, 말뚝 길이 8.5m)
const SECTION_X0 = -1136.05, SECTION_X1 = -1080.05;
const GROUP_EDGES = [-1128.40, -1119.40, -1110.40, -1096.40, -1086.40];
const GROUP_TOPS = [77.97, 77.67, 77.37, 77.07, 76.77, 76.47];
const groupOf = secX => {
  let g = 0;
  while (g < GROUP_EDGES.length && secX > GROUP_EDGES[g]) g++;
  return g;
};
const pileGroup = j => {
  const secX = SECTION_X0 + ((WALE_LENGTH - j * SPACING) / WALE_LENGTH) * (SECTION_X1 - SECTION_X0);
  return groupOf(secX);
};
const topOfPile = j => GROUP_TOPS[pileGroup(j)];

[ROW_A, ROW_B].forEach(row => {
  for (let i = 0; i < PILES_PER_ROW; i++) {
    const top = topOfPile(i);
    pushPart('h-pile2', { x: row.x + i * SPACING, y: row.y, z: top - PILE_LENGTH / 2 });
  }
  const panelInner = (row === ROW_A ? -1 : 1) * (PILE_HALF - FLANGE_T - PANEL_HALF);
  for (let j = 0; j < PILES_PER_ROW - 1; j++) {
    const top = Math.min(topOfPile(j), topOfPile(j + 1));
    pushPart('토류판', { x: row.x + j * SPACING + SPACING / 2, y: row.y + panelInner, z: top - PILE_LENGTH / 2 });
  }

  const innerSign = row === ROW_A ? -1 : 1;
  const waleY = row.y + innerSign * (PILE_HALF + WALE_HALF);
  for (let g = 0; g < GROUP_TOPS.length; g++) {
    const piles = [];
    for (let j = 0; j < PILES_PER_ROW; j++) if (pileGroup(j) === g) piles.push(j);
    if (piles.length === 0) continue;
    const x0 = row.x + piles[0] * SPACING;
    const x1 = row.x + piles[piles.length - 1] * SPACING;
    const shift = GROUP_TOPS[g] - GROUP_TOPS[0];
    WALE_LEVELS.forEach(level => {
      const c = level + shift;
      [c - WALE_HALF, c + WALE_HALF].forEach(z => {
        pushPart('띠장', { x: (x0 + x1) / 2, y: waleY, z, length: Math.max(x1 - x0, SPACING) + 2 * PILE_HALF });
      });
    });
  }
});

const blockCenter = name => {
  const xs = [], ys = [];
  plan.blocks[name].entities.forEach(e => {
    if (e.vertices) e.vertices.forEach(v => { xs.push(v.x); ys.push(v.y); });
    if (e.center && e.radius) { xs.push(e.center.x - e.radius, e.center.x + e.radius); ys.push(e.center.y - e.radius, e.center.y + e.radius); }
  });
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
};
const trueCenter = i => {
  const c = blockCenter(i.name), r = ((i.rotation || 0) * Math.PI) / 180;
  return {
    x: i.position.x + c.x * Math.cos(r) - c.y * Math.sin(r),
    y: i.position.y + c.x * Math.sin(r) + c.y * Math.cos(r)
  };
};
const inWall = p => p.x >= ROW_A.x - 0.5 && p.x <= ROW_A.x + WALE_LENGTH + 0.5 && p.y >= ROW_B.y - 1 && p.y <= ROW_A.y + 1;
const planCenters = name => plan.entities.filter(e => e.type === 'INSERT' && e.name === name).map(trueCenter).filter(inWall);
const BUTT_STATIONS = [0.5, ...Array.from({ length: 12 }, (_, k) => 4.5 + 5 * k)];
const WALE_OFFSET = PILE_HALF + WALE_HALF;
const waleYA = ROW_A.y - WALE_OFFSET;
const waleYB = ROW_B.y + WALE_OFFSET;
const PIECE_HALF = 0.15;
const pieceYA = waleYA - WALE_HALF - PIECE_HALF;
const pieceYB = waleYB + WALE_HALF + PIECE_HALF;
const BUTT_CENTER_Y = (pieceYA + pieceYB) / 2;
const JACK_L = 0.5995;
const BUTT_LENGTH = (pieceYA - pieceYB) - 2 * PIECE_HALF - JACK_L;
const buttEndA = pieceYA - PIECE_HALF;
const buttEndB = pieceYB + PIECE_HALF;
const jackOnA = i => (BUTT_STATIONS.length - 1 - i) % 2 === 0;
BUTT_STATIONS.forEach((s, i) => {
  const g = pileGroup(Math.round(s / SPACING));
  const shift = GROUP_TOPS[g] - GROUP_TOPS[0];
  const onA = jackOnA(i);
  const buttY = onA ? (buttEndB + buttEndA - JACK_L) / 2 : (buttEndB + JACK_L + buttEndA) / 2;
  WALE_LEVELS.forEach(level => {
    const c = level + shift;
    pushPart('수직PIECE', { x: ROW_A.x + s, y: pieceYA, z: c });
    pushPart('수직PIECE', { x: ROW_B.x + s, y: pieceYB, z: c });
    pushPart('스크류잭', onA
      ? { x: ROW_A.x + s, y: buttEndA - JACK_L / 2, z: c }
      : { x: ROW_A.x + s, y: buttEndB + JACK_L / 2, z: c });
    pushPart('버팀보Y', { x: ROW_A.x + s, y: buttY, z: c, length: BUTT_LENGTH });
  });
});

const hpCenters = planCenters('H-PILE');
hpCenters.forEach(p => {
  const j = Math.round((p.x - ROW_A.x) / SPACING);
  pushPart('H-PILE', { x: p.x, y: p.y, z: topOfPile(j) - PILE_LENGTH / 2 });
});

const CHANNEL_H = 0.38, CHANNEL_B = 0.10, H_PILE_HALF = 0.15;
const runs = [];
[...hpCenters].sort((a, b) => a.x - b.x).forEach(p => {
  const last = runs[runs.length - 1];
  if (last && Math.abs(last.y - p.y) < 0.01) last.xs.push(p.x);
  else runs.push({ y: p.y, xs: [p.x] });
});
runs.forEach(r => {
  const x0 = Math.min(...r.xs), x1 = Math.max(...r.xs);
  const xc = (x0 + x1) / 2;
  const g = pileGroup(Math.round((xc - ROW_A.x) / SPACING));
  const shift = GROUP_TOPS[g] - GROUP_TOPS[0];
  const cy = r.y > BUTT_CENTER_Y ? r.y - H_PILE_HALF - CHANNEL_B / 2 : r.y + H_PILE_HALF + CHANNEL_B / 2;
  WALE_LEVELS.forEach(level => {
    const c = level + shift;
    pushPart('채널', { x: xc, y: cy, z: c + WALE_HALF + CHANNEL_H / 2, length: x1 - x0 + 2 * H_PILE_HALF });
  });
});

const counts = {};
parts.forEach(p => { counts[p.memberType] = (counts[p.memberType] || 0) + 1; });

// 굴착 바닥: A-A 녹색 경사선 (단면 X -1146.49, EL 72.91 → X -1070.91, EL 70.58) 을 벽체 X 범위에 대응
const GREEN_P0 = { secX: -1146.49, el: 72.91 }, GREEN_P1 = { secX: -1070.91, el: 70.58 };
const greenEl = secX => GREEN_P0.el + ((secX - GREEN_P0.secX) * (GREEN_P1.el - GREEN_P0.el)) / (GREEN_P1.secX - GREEN_P0.secX);
const secOfPlanX = x => SECTION_X1 - ((x - ROW_A.x) * (SECTION_X1 - SECTION_X0)) / WALE_LENGTH;
const EXC_STEP = 1;
const SURFACE_EXTEND = 5;
const excStations = Array.from({ length: (WALE_LENGTH + 2 * SURFACE_EXTEND) / EXC_STEP + 1 }, (_, k) => ROW_A.x - SURFACE_EXTEND + k * EXC_STEP);
const excavation = {
  yA: ROW_A.y - PILE_HALF,
  yB: ROW_B.y + PILE_HALF,
  profile: excStations.map(x => ({ x, z: greenEl(secOfPlanX(x)) }))
};

// 도로면: A-A 가장 높은 녹색 점선 (단면 X -1146.49, EL 77.01 → X -1070.91, EL 74.68), 엄지말뚝 외측 양쪽
const ROAD_P0 = { secX: -1146.49, el: 77.01 }, ROAD_P1 = { secX: -1070.91, el: 74.68 };
const roadEl = secX => ROAD_P0.el + ((secX - ROAD_P0.secX) * (ROAD_P1.el - ROAD_P0.el)) / (ROAD_P1.secX - ROAD_P0.secX);
const ROAD_WIDTH = 10;
const roadProfile = excStations.map(x => ({ x, z: roadEl(secOfPlanX(x)) }));
const road = [
  { y0: ROW_A.y + PILE_HALF, y1: ROW_A.y + PILE_HALF + ROAD_WIDTH, profile: roadProfile },
  { y0: ROW_B.y - PILE_HALF - ROAD_WIDTH, y1: ROW_B.y - PILE_HALF, profile: roadProfile }
];

const xs = parts.map(p => p.position.x), ys = parts.map(p => p.position.y);
const stats = {
  timestamp: new Date().toISOString(),
  method: 'v4-plan-2row',
  unit: 'm',
  origin: '평면도 좌표 (엄지말뚝 열 A/B 시작점 기준)',
  totalParts: parts.length,
  partsByType: counts,
  parts,
  excavation,
  road
};
fs.writeFileSync('out/gasiseol-v4-stats.json', JSON.stringify(stats, null, 2), 'utf-8');

console.log('부재 구성:', counts);
console.log(`범위 X ${Math.min(...xs).toFixed(1)}~${Math.max(...xs).toFixed(1)}  Y ${Math.min(...ys).toFixed(1)}~${Math.max(...ys).toFixed(1)}`);
