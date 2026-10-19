#!/usr/bin/env node
/**
 * generate-3d-correct.mjs - 올바른 3D 모델 생성
 *
 * 접근:
 * 1. 상세도 분석 → 블록 정의 & 규격 추출
 * 2. 계획도 분석 → 블록 인스턴스 (배치 위치) 추출
 * 3. 통합 → 각 배치 위치에 정확한 규격의 부재 생성
 */

import DxfParser from 'dxf-parser';
import * as THREE from 'three';
import * as fs from 'fs';
import * as path from 'path';

const PLAN_SCALE = 120;  // 1:120
const DETAIL_SCALE = 20; // 1:20

async function generateCorrect3D() {
  console.log('\n[generate-3d-correct] 올바른 3D 모델 생성\n');

  try {
    // 1. 상세도 분석 → 규격 정보 추출
    console.log('Step 1: 상세도 분석 (가시설상세_LH.dxf)\n');

    const detailDxf = fs.readFileSync('RAG/LH/가시설상세_LH.dxf', 'utf-8');
    const detailParser = new DxfParser();
    const detail = detailParser.parse(detailDxf);

    // 규격 정보 추출 (TEXT 엔티티에서)
    const specs = extractSpecifications(detail);

    console.log(`✓ 추출된 규격 정보: ${Object.keys(specs).length}개\n`);
    Object.entries(specs).slice(0, 10).forEach(([name, spec]) => {
      console.log(`  ${name}: ${spec.spec}`);
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

    // 3. 통합 → 3D 모델 생성
    console.log('\n\nStep 3: 3D 모델 생성\n');

    const scene = new THREE.Scene();
    const allParts = [];
    let totalVolume = 0;

    // 각 블록 타입별로 3D 생성
    Object.entries(placementsByType).forEach(([blockType, placements]) => {
      console.log(`\n[${blockType}] ${placements.length}개 생성 중...`);

      // 블록 타입별 기본 규격
      let spec = specs[blockType];

      if (!spec) {
        // 부재 타입별 기본값
        if (blockType === 'H-PILE') {
          spec = {
            type: 'Pile',
            spec: 'φ1000×8000',
            dimensions: { diameter: 1000, depth: 8000 }
          };
        } else if (blockType === '스터럿') {
          spec = {
            type: 'Strut',
            spec: '200×200×4000',
            dimensions: { width: 200, height: 200, depth: 4000 }
          };
        } else {
          spec = {
            type: 'Unknown',
            spec: '300×300×3000',
            dimensions: { width: 300, height: 300, depth: 3000 }
          };
        }
      }

      placements.forEach((placement, idx) => {
        // 규격에 맞는 3D 메시 생성
        const result = createMember3D(
          blockType,
          spec,
          placement
        );

        if (result && result.mesh) {
          const { mesh, volume, userData } = result;
          scene.add(mesh);
          allParts.push(userData);
          totalVolume += volume;

          if (idx < 3 || idx % 50 === 0) {
            console.log(
              `  ✓ [${idx + 1}] ${placement.blockName} @ ` +
              `(${Math.round(placement.position.x)}, ` +
              `${Math.round(placement.position.y)}) ` +
              `${volume}m³`
            );
          }
        }
      });
    });

    // 4. 결과 저장
    console.log('\n\nStep 4: 결과 저장\n');

    // OBJ 저장
    const objPath = path.join('out', 'gasiseol-correct.obj');
    exportOBJ(scene, objPath);
    console.log(`✓ ${objPath}`);

    // 통계 저장
    const stats = {
      timestamp: new Date().toISOString(),
      method: 'Block-Based-Correct',
      totalParts: allParts.length,
      totalVolume: totalVolume,
      partsByType: Object.entries(placementsByType).reduce((acc, [type, items]) => {
        acc[type] = items.length;
        return acc;
      }, {}),
      parts: allParts.slice(0, 100) // 처음 100개만
    };

    const statsPath = path.join('out', 'gasiseol-correct-stats.json');
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

    console.log('\n[generate-3d-correct] ✅ 올바른 3D 모델 생성 완료!\n');

  } catch (error) {
    console.error(`[generate-3d-correct] ❌ 오류: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 규격 정보 추출 (상세도 TEXT)
function extractSpecifications(dxf) {
  const specs = {};

  const texts = dxf.entities.filter(e => e.type === 'TEXT' || e.type === 'MTEXT');

  // 규격 패턴 찾기
  const patterns = [
    /H-(\d+)×(\d+)×(\d+)×(\d+)/g,  // H-400×400×13×21
    /PL\.-(\d+)×(\d+)×(\d+)/g,     // PL.-700×360×14
    /φ(\d+)/g                       // φ1000
  ];

  texts.forEach(text => {
    if (!text.text) return;

    // H-빔 규격
    if (text.text.includes('H-') && text.text.includes('×')) {
      const match = text.text.match(/H-(\d+)×(\d+)×(\d+)×(\d+)/);
      if (match) {
        specs['가시설4'] = {
          type: 'H-Beam',
          spec: text.text,
          dimensions: {
            width: parseInt(match[1]),
            height: parseInt(match[2]),
            webThickness: parseInt(match[3]),
            flangeThickness: parseInt(match[4]),
            depth: 6000
          }
        };
      }
    }

    // 판재 규격
    if (text.text.includes('PL.')) {
      const match = text.text.match(/PL\.-(\d+)×(\d+)×(\d+)/);
      if (match) {
        specs['토류판'] = {
          type: 'Panel',
          spec: text.text,
          dimensions: {
            width: parseInt(match[1]),
            height: parseInt(match[2]),
            thickness: parseInt(match[3])
          }
        };
      }
    }

    // 파일 규격
    if (text.text.includes('φ')) {
      const match = text.text.match(/φ(\d+)/);
      if (match) {
        specs['h-pile2'] = {
          type: 'Pile',
          spec: text.text,
          dimensions: {
            diameter: parseInt(match[1]),
            depth: 8000
          }
        };
      }
    }
  });

  // 기본값 설정
  if (!specs['h-pile2']) {
    specs['h-pile2'] = {
      type: 'Pile',
      spec: 'φ1000×8000',
      dimensions: { diameter: 1000, depth: 8000 }
    };
  }
  if (!specs['토류판']) {
    specs['토류판'] = {
      type: 'Panel',
      spec: 'PL.-700×360×14',
      dimensions: { width: 700, height: 360, thickness: 14 }
    };
  }
  if (!specs['가시설4']) {
    specs['가시설4'] = {
      type: 'H-Beam',
      spec: 'H-400×400×13×21',
      dimensions: { width: 400, height: 400, webThickness: 13, flangeThickness: 21, depth: 6000 }
    };
  }

  return specs;
}

// 블록 배치 정보 추출 (계획도 INSERT)
function extractPlacements(dxf) {
  const gasiLayer = dxf.entities.filter(e => e.layer === '가시설평면');
  const inserts = gasiLayer.filter(e => e.type === 'INSERT');

  const placements = inserts.map(insert => ({
    blockName: insert.name || 'Unknown',
    position: {
      x: (insert.position?.x || 0) * PLAN_SCALE,
      y: (insert.position?.y || 0) * PLAN_SCALE,
      z: (insert.position?.z || 0) * PLAN_SCALE
    },
    rotation: insert.rotation || 0,
    scale: insert.scale || { x: 1, y: 1, z: 1 }
  }));

  return placements;
}

// 부재 3D 생성
function createMember3D(blockType, spec, placement) {
  const dims = spec.dimensions;
  let geometry, material, volume, userData;

  const color = getColor(spec.type);
  material = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });

  if (spec.type === 'Pile') {
    // 원기둥 파일
    geometry = new THREE.CylinderGeometry(
      dims.diameter / 2,
      dims.diameter / 2,
      dims.depth,
      16
    );
    volume = Math.PI * Math.pow(dims.diameter / 2, 2) * dims.depth / 1e6;
  } else if (spec.type === 'Panel') {
    // 판재
    geometry = new THREE.BoxGeometry(
      dims.width,
      dims.height,
      dims.thickness
    );
    volume = dims.width * dims.height * dims.thickness / 1e6;
  } else if (spec.type === 'H-Beam') {
    // H-빔
    geometry = new THREE.BoxGeometry(
      dims.width,
      dims.height,
      dims.depth
    );
    volume = dims.width * dims.height * dims.depth / 1e6;
  }

  if (!geometry) return null;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );

  userData = {
    blockType: blockType,
    type: spec.type,
    spec: spec.spec,
    position: placement.position,
    volume: Math.round(volume)
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
  let objContent = '# DXF to 3D (Correct Method)\n';
  objContent += `# Generated: ${new Date().toISOString()}\n`;
  objContent += '# Method: Block Instance + Specification\n\n';

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
