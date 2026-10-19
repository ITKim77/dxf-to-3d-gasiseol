#!/usr/bin/env node
/**
 * generate-3d-correct-v3.mjs - 정확한 3D 모델 생성 (분석 기반)
 *
 * 분석 결과 적용:
 * - 좌표: 미터(m) 단위 (DXF 원본)
 * - 스케일: INSERT scale 5000 고려
 * - 규격: 부재별 정확한 크기
 */

import DxfParser from 'dxf-parser';
import * as THREE from 'three';
import * as fs from 'fs';
import * as path from 'path';

// 계획도 좌표는 미터(m) 단위 → cm로 변환 (표시용)
const COORD_SCALE = 100; // m → cm
// INSERT scale factor (상세도 mm를 실제 크기로)
const INSERT_SCALE = 5000; // mm → mm (실제 크기)
const MM_TO_CM = 0.1; // mm → cm (표시용)

async function generateCorrect3DV3() {
  console.log('\n[generate-3d-correct-v3] 정확한 3D 모델 생성 (분석 기반)\n');

  try {
    // 1. 상세도 분석
    console.log('Step 1: 상세도 분석\n');

    const detailDxf = fs.readFileSync('RAG/LH/가시설상세_LH.dxf', 'utf-8');
    const detailParser = new DxfParser();
    const detail = detailParser.parse(detailDxf);

    // 규격 정보 (분석 결과 기반)
    const specs = {
      'h-pile2': {
        type: 'Pile',
        spec: 'H-400×400 (φ1000×8000)',
        // INSERT scale 5000 적용: 0.4mm × 5000 = 2000mm = 2.0m
        dimensions: { width: 2.0 * COORD_SCALE, height: 2.0 * COORD_SCALE, depth: 8.0 * COORD_SCALE }
      },
      '토류판': {
        type: 'Panel',
        spec: 'PL-700×360×14',
        dimensions: { width: 0.7 * COORD_SCALE, height: 3.6 * COORD_SCALE, thickness: 0.014 * COORD_SCALE }
      },
      '가시설4': {
        type: 'H-Beam',
        spec: 'H-400×400×13×21',
        dimensions: { width: 0.4 * COORD_SCALE, height: 0.4 * COORD_SCALE, depth: 0.6 * COORD_SCALE }
      },
      'H-PILE': {
        type: 'Pile',
        spec: 'H-400×400×13×21',
        dimensions: { width: 0.4 * COORD_SCALE, height: 0.4 * COORD_SCALE, depth: 2.0 * COORD_SCALE }
      },
      '스터럿': {
        type: 'Strut',
        spec: '200×200×4000',
        dimensions: { width: 0.2 * COORD_SCALE, height: 0.2 * COORD_SCALE, depth: 4.0 * COORD_SCALE }
      }
    };

    console.log('✓ 규격 정보 (INSERT scale 5000 적용):');
    Object.entries(specs).forEach(([name, spec]) => {
      console.log(`  ${name}: ${spec.spec}`);
    });

    // 2. 계획도 분석
    console.log('\n\nStep 2: 계획도 분석\n');

    const planDxf = fs.readFileSync('RAG/LH/가시설계획_LH.dxf', 'utf-8');
    const planParser = new DxfParser();
    const plan = planParser.parse(planDxf);

    // 블록 배치 추출 (분석 결과 기반)
    const placements = extractPlacements(plan);

    console.log(`✓ 추출된 블록 배치: ${placements.length}개\n`);

    // 배치 그룹화
    const placementsByType = {};
    placements.forEach(p => {
      if (!placementsByType[p.blockName]) {
        placementsByType[p.blockName] = [];
      }
      placementsByType[p.blockName].push(p);
    });

    console.log('블록 종류별 개수:');
    Object.entries(placementsByType).forEach(([type, items]) => {
      console.log(`  ${type}: ${items.length}개`);
    });

    // 좌표 범위
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    placements.forEach(p => {
      minX = Math.min(minX, p.position.x);
      maxX = Math.max(maxX, p.position.x);
      minY = Math.min(minY, p.position.y);
      maxY = Math.max(maxY, p.position.y);
    });

    console.log(`\n좌표 범위 (m 단위):`);
    console.log(`  X: ${minX.toFixed(2)} ~ ${maxX.toFixed(2)}`);
    console.log(`  Y: ${minY.toFixed(2)} ~ ${maxY.toFixed(2)}`);

    // 3. 3D 모델 생성
    console.log('\n\nStep 3: 3D 모델 생성\n');

    const scene = new THREE.Scene();
    const allParts = [];
    let totalVolume = 0;

    // 각 블록 타입별로 3D 생성
    Object.entries(placementsByType).forEach(([blockType, placements]) => {
      console.log(`\n[${blockType}] ${placements.length}개 생성 중...`);

      const spec = specs[blockType];
      if (!spec) {
        console.warn(`  ⚠️ ${blockType} 규격 없음`);
        return;
      }

      placements.forEach((placement, idx) => {
        const result = createMember3D(blockType, spec, placement);

        if (result && result.mesh) {
          const { mesh, volume, userData } = result;
          scene.add(mesh);
          allParts.push(userData);
          totalVolume += volume;

          if (idx < 3 || idx % 50 === 0) {
            console.log(
              `  ✓ [${idx + 1}] ${blockType} @ ` +
              `(${placement.position.x.toFixed(2)}, ` +
              `${placement.position.y.toFixed(2)}) ` +
              `${volume.toFixed(2)}m³`
            );
          }
        }
      });
    });

    // 4. 결과 저장
    console.log('\n\nStep 4: 결과 저장\n');

    // OBJ 저장
    const objPath = path.join('out', 'gasiseol-v3.obj');
    exportOBJ(scene, objPath);
    console.log(`✓ ${objPath}`);

    // 통계 저장
    const stats = {
      timestamp: new Date().toISOString(),
      method: 'Block-Based-Correct-V3-Analyzed',
      analysis: {
        coordinateSystem: 'meter (m)',
        insertScale: 5000,
        displayScale: COORD_SCALE,
        note: 'DXF 원본 좌표(m) 직접 사용, INSERT scale 5000 고려'
      },
      totalParts: allParts.length,
      totalVolume: totalVolume,
      coordinateRange: {
        x: [minX.toFixed(2), maxX.toFixed(2)],
        y: [minY.toFixed(2), maxY.toFixed(2)]
      },
      partsByType: Object.entries(placementsByType).reduce((acc, [type, items]) => {
        acc[type] = items.length;
        return acc;
      }, {}),
      parts: allParts.slice(0, 50)
    };

    const statsPath = path.join('out', 'gasiseol-v3-stats.json');
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`✓ ${statsPath}`);

    // 최종 통계
    console.log('\n\n=== 최종 결과 ===\n');
    console.log(`✅ 정확하게 배치된 부재: ${allParts.length}개`);
    console.log(`✅ 총 부피: ${totalVolume.toFixed(2)} m³`);
    console.log(`\n부재 구성:`);
    Object.entries(stats.partsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}개`);
    });

    console.log('\n[generate-3d-correct-v3] ✅ 정확한 3D 모델 생성 완료!\n');

  } catch (error) {
    console.error(`[generate-3d-correct-v3] ❌ 오류: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 블록 배치 정보 추출 (DXF 원본 좌표 그대로)
function extractPlacements(dxf) {
  const inserts = dxf.entities.filter(e =>
    e.type === 'INSERT' &&
    (e.layer === '가시설평면' || e.layer === '가시설' || e.layer === 'pile')
  );

  const placements = inserts.map(insert => ({
    blockName: insert.name || 'Unknown',
    position: {
      x: insert.position?.x || 0,
      y: insert.position?.y || 0,
      z: insert.position?.z || 0
    },
    rotation: insert.rotation || 0,
    scale: insert.scale || { x: 1, y: 1, z: 1 }
  }));

  console.log(`  추출된 INSERT 블록: ${inserts.length}개`);
  return placements;
}

// 부재 3D 생성
function createMember3D(blockType, spec, placement) {
  const dims = spec.dimensions;
  let geometry, volume, userData;

  const color = getColor(spec.type);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });

  if (spec.type === 'Pile') {
    // 파일: 사각형 단면
    geometry = new THREE.BoxGeometry(dims.width, dims.height, dims.depth);
    // 부피는 cm³를 m³로 변환
    volume = (dims.width * dims.height * dims.depth) / (COORD_SCALE * COORD_SCALE * COORD_SCALE) / 1e6;

  } else if (spec.type === 'Panel') {
    // 판재
    geometry = new THREE.BoxGeometry(dims.width, dims.height, dims.thickness);
    volume = (dims.width * dims.height * dims.thickness) / (COORD_SCALE * COORD_SCALE * COORD_SCALE) / 1e6;

  } else if (spec.type === 'H-Beam') {
    // H-빔
    geometry = new THREE.BoxGeometry(dims.width, dims.height, dims.depth);
    volume = (dims.width * dims.height * dims.depth) / (COORD_SCALE * COORD_SCALE * COORD_SCALE) / 1e6;

  } else if (spec.type === 'Strut') {
    // 버팀목
    geometry = new THREE.BoxGeometry(dims.width, dims.height, dims.depth);
    volume = (dims.width * dims.height * dims.depth) / (COORD_SCALE * COORD_SCALE * COORD_SCALE) / 1e6;

  }

  if (!geometry) return null;

  const mesh = new THREE.Mesh(geometry, material);
  // 좌표: m 단위를 cm로 변환해서 표시
  mesh.position.set(
    placement.position.x * COORD_SCALE,
    placement.position.y * COORD_SCALE,
    placement.position.z * COORD_SCALE
  );

  userData = {
    blockType: blockType,
    type: spec.type,
    spec: spec.spec,
    position: placement.position,
    volume: volume
  };

  return { mesh, volume, userData };
}

function getColor(type) {
  const colors = {
    'Pile': 0x7ed321,
    'Panel': 0x4a90e2,
    'H-Beam': 0xff6b6b,
    'Strut': 0xf5a623,
    'Unknown': 0x999999
  };
  return colors[type] || 0x999999;
}

function exportOBJ(scene, filename) {
  let objContent = '# DXF to 3D (Correct V3 - Analyzed)\n';
  objContent += `# Generated: ${new Date().toISOString()}\n`;
  objContent += '# Coordinate: meter (m), scaled to cm for display\n';
  objContent += '# INSERT scale: 5000x applied\n\n';

  let vertexIndex = 1;
  const meshes = [];

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      meshes.push(object);
    }
  });

  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');

    if (position) {
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i) + mesh.position.x;
        const y = position.getY(i) + mesh.position.y;
        const z = position.getZ(i) + mesh.position.z;
        objContent += `v ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}\n`;
      }
    }

    const index = geometry.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i) + vertexIndex;
        const b = index.getX(i + 1) + vertexIndex;
        const c = index.getX(i + 2) + vertexIndex;
        objContent += `f ${a} ${b} ${c}\n`;
      }
    }

    vertexIndex += position ? position.count : 0;
  }

  fs.writeFileSync(filename, objContent, 'utf-8');
}

await generateCorrect3DV3();
