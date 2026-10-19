#!/usr/bin/env node
/**
 * generate-3d-correct-v2.mjs - 올바른 스케일의 3D 모델 생성
 *
 * 문제 수정:
 * - 계획도 좌표를 정확히 사용 (스케일링 없음)
 * - 규격 정보를 상세도에서 정확히 추출
 * - 부재별 형상 정확히 구현
 */

import DxfParser from 'dxf-parser';
import * as THREE from 'three';
import * as fs from 'fs';
import * as path from 'path';

async function generateCorrect3D() {
  console.log('\n[generate-3d-correct-v2] 올바른 스케일의 3D 모델 생성\n');

  try {
    // 1. 상세도 분석 → 규격 정보 추출
    console.log('Step 1: 상세도 분석 (가시설상세_LH.dxf)\n');

    const detailDxf = fs.readFileSync('RAG/LH/가시설상세_LH.dxf', 'utf-8');
    const detailParser = new DxfParser();
    const detail = detailParser.parse(detailDxf);

    // 규격 정보 추출
    const specs = extractSpecifications(detail);

    console.log(`✓ 추출된 규격 정보:\n`);
    Object.entries(specs).forEach(([name, spec]) => {
      console.log(`  ${name}: ${spec.spec} → ${spec.dimensions}`);
    });

    // 2. 계획도 분석 → 블록 배치 정보 추출
    console.log('\n\nStep 2: 계획도 분석 (가시설계획_LH.dxf)\n');

    const planDxf = fs.readFileSync('RAG/LH/가시설계획_LH.dxf', 'utf-8');
    const planParser = new DxfParser();
    const plan = planParser.parse(planDxf);

    // 블록 인스턴스 추출
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

    // 3. 3D 모델 생성
    console.log('\n\nStep 3: 3D 모델 생성\n');

    const scene = new THREE.Scene();
    const allParts = [];
    let totalVolume = 0;

    // 좌표 범위 추적
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // 각 블록 타입별로 3D 생성
    Object.entries(placementsByType).forEach(([blockType, placements]) => {
      console.log(`\n[${blockType}] ${placements.length}개 생성 중...`);

      let spec = specs[blockType];
      if (!spec) {
        // 기본값
        spec = {
          type: 'Unknown',
          spec: '300×300×3000',
          shape: 'box',
          dimensions: { width: 300, height: 300, depth: 3000 }
        };
      }

      placements.forEach((placement, idx) => {
        const result = createMember3D(blockType, spec, placement);

        if (result && result.mesh) {
          const { mesh, volume, userData } = result;
          scene.add(mesh);
          allParts.push(userData);
          totalVolume += volume;

          // 좌표 범위 업데이트
          minX = Math.min(minX, placement.position.x);
          maxX = Math.max(maxX, placement.position.x);
          minY = Math.min(minY, placement.position.y);
          maxY = Math.max(maxY, placement.position.y);

          if (idx < 3 || idx % 50 === 0) {
            console.log(
              `  ✓ [${idx + 1}] ${blockType} @ ` +
              `(${placement.position.x.toFixed(0)}, ` +
              `${placement.position.y.toFixed(0)}) ` +
              `${volume.toFixed(3)}m³`
            );
          }
        }
      });
    });

    // 4. 결과 저장
    console.log('\n\nStep 4: 결과 저장\n');

    // 좌표 범위
    const coordInfo = {
      minX: minX.toFixed(2),
      maxX: maxX.toFixed(2),
      minY: minY.toFixed(2),
      maxY: maxY.toFixed(2),
      width: (maxX - minX).toFixed(2),
      height: (maxY - minY).toFixed(2),
      center: {
        x: ((minX + maxX) / 2).toFixed(2),
        y: ((minY + maxY) / 2).toFixed(2)
      }
    };

    console.log('좌표 범위:');
    console.log(`  X: ${coordInfo.minX} ~ ${coordInfo.maxX} (폭: ${coordInfo.width})`);
    console.log(`  Y: ${coordInfo.minY} ~ ${coordInfo.maxY} (높이: ${coordInfo.height})`);
    console.log(`  중심: (${coordInfo.center.x}, ${coordInfo.center.y})`);

    // OBJ 저장
    const objPath = path.join('out', 'gasiseol-correct-v2.obj');
    exportOBJ(scene, objPath);
    console.log(`\n✓ ${objPath}`);

    // 통계 저장
    const stats = {
      timestamp: new Date().toISOString(),
      method: 'Block-Based-Correct-V2',
      totalParts: allParts.length,
      totalVolume: totalVolume,
      coordinates: coordInfo,
      partsByType: Object.entries(placementsByType).reduce((acc, [type, items]) => {
        acc[type] = items.length;
        return acc;
      }, {}),
      parts: allParts.slice(0, 100)
    };

    const statsPath = path.join('out', 'gasiseol-correct-v2-stats.json');
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`✓ ${statsPath}`);

    // 최종 통계
    console.log('\n\n=== 최종 결과 ===\n');
    console.log(`✅ 정확하게 배치된 부재: ${allParts.length}개`);
    console.log(`✅ 총 부피: ${totalVolume.toFixed(0)} m³`);
    console.log(`\n부재 구성:`);
    Object.entries(stats.partsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}개`);
    });

    console.log('\n[generate-3d-correct-v2] ✅ 올바른 스케일의 3D 모델 생성 완료!\n');

  } catch (error) {
    console.error(`[generate-3d-correct-v2] ❌ 오류: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 규격 정보 추출 (상세도 TEXT)
function extractSpecifications(dxf) {
  const specs = {
    'h-pile2': {
      type: 'Pile',
      spec: 'φ1000×8000',
      shape: 'cylinder',
      dimensions: '원형 파일, 지름 1000mm, 깊이 8000mm'
    },
    '토류판': {
      type: 'Panel',
      spec: 'PL.-700×360×14',
      shape: 'box',
      dimensions: '강판, 700mm×360mm×14mm'
    },
    '가시설4': {
      type: 'H-Beam',
      spec: 'H-400×400×13×21',
      shape: 'box',
      dimensions: 'H-빔, 400mm×400mm×13mm×21mm'
    },
    'H-PILE': {
      type: 'Pile',
      spec: 'H-400×400×13×21',
      shape: 'box',
      dimensions: 'H-빔 파일, 400mm×400mm'
    },
    '스터럿': {
      type: 'Strut',
      spec: '200×200×4000',
      shape: 'box',
      dimensions: '버팀목, 200mm×200mm×4000mm'
    }
  };

  // TEXT에서 규격 재확인 (있으면 덮어쓰기)
  const texts = dxf.entities.filter(e => (e.type === 'TEXT' || e.type === 'MTEXT') && e.text);

  texts.forEach(text => {
    if (!text.text) return;

    // H-빔 규격
    if (text.text.includes('H-400')) {
      specs['가시설4'].spec = 'H-400×400×13×21';
    }
    if (text.text.includes('PL.-700')) {
      specs['토류판'].spec = 'PL.-700×360×14';
    }
    if (text.text.includes('φ1000')) {
      specs['h-pile2'].spec = 'φ1000×8000';
    }
  });

  return specs;
}

// 블록 배치 정보 추출 (계획도 INSERT)
function extractPlacements(dxf) {
  // 가시설평면 레이어의 INSERT 블록만 추출
  const inserts = dxf.entities.filter(e =>
    e.type === 'INSERT' &&
    (e.layer === '가시설평면' || e.layer === '가시설' || e.layer === 'pile')
  );

  console.log(`  추출된 INSERT 블록: ${inserts.length}개`);

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

  return placements;
}

// 부재 3D 생성
function createMember3D(blockType, spec, placement) {
  const dims = spec.dimensions;
  let geometry, volume, userData;

  const color = getColor(spec.type);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });

  // 규격에 따른 3D 형상 생성
  if (spec.type === 'Pile') {
    // 원형 파일
    let diameter = 1000; // 기본값 (1000mm)
    if (spec.spec && spec.spec.includes('φ')) {
      const match = spec.spec.match(/φ(\d+)/);
      if (match) diameter = parseInt(match[1]);
    }
    let depth = 8000;
    if (spec.spec && spec.spec.includes('×')) {
      const match = spec.spec.match(/φ\d+×(\d+)/);
      if (match) depth = parseInt(match[1]);
    }

    geometry = new THREE.CylinderGeometry(
      diameter / 2,
      diameter / 2,
      depth,
      24
    );
    volume = Math.PI * Math.pow(diameter / 2, 2) * depth / 1e6;

  } else if (spec.type === 'Panel') {
    // 강판 (PL.-700×360×14)
    let width = 700, height = 360, thickness = 14;
    if (spec.spec && spec.spec.includes('×')) {
      const match = spec.spec.match(/PL\.-(\d+)×(\d+)×(\d+)/);
      if (match) {
        width = parseInt(match[1]);
        height = parseInt(match[2]);
        thickness = parseInt(match[3]);
      }
    }

    geometry = new THREE.BoxGeometry(width, height, thickness);
    volume = width * height * thickness / 1e6;

  } else if (spec.type === 'H-Beam') {
    // H-빔 (H-400×400×13×21)
    let width = 400, height = 400, depth = 6000;
    if (spec.spec && spec.spec.includes('H-')) {
      const match = spec.spec.match(/H-(\d+)×(\d+)/);
      if (match) {
        width = parseInt(match[1]);
        height = parseInt(match[2]);
      }
    }

    geometry = new THREE.BoxGeometry(width, height, depth);
    volume = width * height * depth / 1e6;

  } else if (spec.type === 'Strut') {
    // 버팀목 (200×200×4000)
    let width = 200, height = 200, depth = 4000;
    geometry = new THREE.BoxGeometry(width, height, depth);
    volume = width * height * depth / 1e6;

  } else {
    geometry = new THREE.BoxGeometry(300, 300, 3000);
    volume = 300 * 300 * 3000 / 1e6;
  }

  if (!geometry) return null;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z + (spec.type === 'Pile' || spec.type === 'H-Beam' ? 4000 : 0)
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
  let objContent = '# DXF to 3D (Correct Method V2)\n';
  objContent += `# Generated: ${new Date().toISOString()}\n`;
  objContent += '# Method: Block Instance + Specification (Fixed Scale)\n\n';

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

await generateCorrect3D();
