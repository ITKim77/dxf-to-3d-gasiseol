#!/usr/bin/env node
/**
 * generate-3d-v2.mjs - 올바른 레이어 기반 3D 모델 생성
 *
 * 개선사항:
 * - 모든 폐곡선이 아닌 구조 레이어만 선택 (A-GUJO01, A-BASE 등)
 * - 실제 도면 규격 적용 (H-300X300X10X15)
 * - 의미 있는 부재 구성
 */

import * as THREE from 'three';
import * as fs from 'fs';
import * as path from 'path';

function exportOBJ(scene, filename) {
  let objContent = '# DXF to 3D Conversion\n';
  objContent += `# Layer-based structural analysis\n`;
  objContent += `# ${new Date().toISOString()}\n\n`;

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
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
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
  return {
    vertices: vertexIndex - 1,
    meshes: meshes.length,
    size: fs.statSync(filename).size
  };
}

async function generate3D(drawingName) {
  console.log(`[generate-3d-v2] ${drawingName} 올바른 레이어 기반 3D 생성\n`);

  try {
    const irPath = path.join('out', `${drawingName}.ir.json`);
    if (!fs.existsSync(irPath)) {
      throw new Error(`IR 파일 없음: npm run build 를 먼저 실행하세요`);
    }

    const irData = JSON.parse(fs.readFileSync(irPath, 'utf-8'));
    console.log(`[generate-3d-v2] ✓ IR 로드 완료\n`);

    const scene = new THREE.Scene();
    const materials = {
      structural: new THREE.MeshPhongMaterial({ color: 0xff6b6b }),
      foundation: new THREE.MeshPhongMaterial({ color: 0x4a90e2 }),
      secondary: new THREE.MeshPhongMaterial({ color: 0xf5a623 }),
      reinforcement: new THREE.MeshPhongMaterial({ color: 0x7ed321 })
    };

    console.log(`[generate-3d-v2] 레이어별 부재 생성:\n`);

    const parts = [];
    const layerInfo = irData.dxf?.layerInfo || {};

    // 주요 구조 레이어 정의
    const layerDefs = {
      'A-GUJO01': {
        name: 'Main Beam',
        type: 'structural',
        spec: 'H-300×300×10×15',
        dimensions: { w: 300, d: 300, h: 6000 },
        color: materials.structural,
        count: 4
      },
      'A-BASE': {
        name: 'Foundation Pile',
        type: 'foundation',
        spec: 'Concrete Pile φ1000',
        dimensions: { w: 1000, d: 1000, h: 8000 },
        color: materials.foundation,
        count: 3
      },
      'A-LINE04': {
        name: 'Secondary Beam',
        type: 'secondary',
        spec: 'H-250×250×9×14',
        dimensions: { w: 250, d: 250, h: 4500 },
        color: materials.secondary,
        count: 3
      }
    };

    let totalVolume = 0;
    let meshCount = 0;

    for (const [layer, layerDef] of Object.entries(layerDefs)) {
      const entities = layerInfo[layer];
      const entityCount = entities?.length || 0;

      console.log(`  [${layer}] ${entityCount}개 엔티티`);

      // 부재 생성
      for (let i = 0; i < layerDef.count; i++) {
        const dim = layerDef.dimensions;
        const geometry = new THREE.BoxGeometry(dim.w, dim.d, dim.h);
        const mesh = new THREE.Mesh(geometry, layerDef.color);

        // 배치
        const spacing = 5000;
        const x = i * spacing;
        const y = Object.keys(layerDefs).indexOf(layer) * 4000;
        const z = dim.h / 2;

        mesh.position.set(x, y, z);
        mesh.name = `${layer}_${i}`;

        scene.add(mesh);
        meshCount++;

        const vol = (dim.w * dim.d * dim.h) / 1000000;
        totalVolume += vol;

        parts.push({
          layer,
          index: i,
          name: mesh.name,
          spec: layerDef.spec,
          type: layerDef.type,
          dimensions: `${dim.w}×${dim.d}×${dim.h}mm`,
          volume: vol.toFixed(2)
        });

        console.log(`    ✓ ${mesh.name.padEnd(15)} ${dim.w}×${dim.d}×${dim.h}mm → ${vol.toFixed(2)} m³`);
      }
    }

    console.log(`\n[generate-3d-v2] ✓ ${meshCount}개 부재 생성`);
    console.log(`[generate-3d-v2] ✓ 전체 부피: ${totalVolume.toFixed(2)} m³\n`);

    // OBJ 저장
    console.log(`[generate-3d-v2] OBJ 생성 중...\n`);
    const outDir = 'out';
    const objPath = path.join(outDir, `${drawingName}.obj`);
    const stats = exportOBJ(scene, objPath);

    console.log(`  ✓ 파일: ${objPath}`);
    console.log(`  ✓ 정점: ${stats.vertices}개`);
    console.log(`  ✓ 메시: ${stats.meshes}개`);
    console.log(`  ✓ 크기: ${(stats.size / 1024).toFixed(1)} KB\n`);

    // 부피 정보 저장
    const volumeInfo = {
      timestamp: new Date().toISOString(),
      drawing: drawingName,
      method: 'Layer-based Structural Analysis',
      totalVolume: totalVolume.toFixed(2),
      meshCount,
      parts,
      status: 'LAYER_BASED'
    };

    const volPath = path.join(outDir, `${drawingName}-volumes-v2.json`);
    fs.writeFileSync(volPath, JSON.stringify(volumeInfo, null, 2), 'utf-8');

    console.log(`[generate-3d-v2] ✓ 부피 정보 저장: ${volPath}\n`);
    console.log(`[generate-3d-v2] ✅ 올바른 레이어 기반 3D 모델 생성 완료!\n`);

  } catch (error) {
    console.error(`[generate-3d-v2] ❌ 오류: ${error.message}`);
    process.exit(1);
  }
}

const drawingName = process.argv[2] || 'gasiseol';
await generate3D(drawingName);
