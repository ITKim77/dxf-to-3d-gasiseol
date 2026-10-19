#!/usr/bin/env node
/**
 * generate-3d-lh-full.mjs - LH 도면 전체 3D 모델 생성 (상세 버전)
 */

import DxfParser from 'dxf-parser';
import * as THREE from 'three';
import * as fs from 'fs';
import * as path from 'path';

const SCALE = 120; // 축척 1:120

async function generate3DLHFull(filename = '가시설계획_LH') {
  console.log(`\n[generate-3d-lh-full] ${filename} - 상세 3D 모델 생성\n`);

  try {
    const dxfPath = path.join('RAG/LH', `${filename}.dxf`);
    const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
    const parser = new DxfParser();
    const dxf = parser.parse(dxfContent);

    const scene = new THREE.Scene();
    const allParts = [];
    let totalVolume = 0;

    console.log('=== 부재 추출 ===\n');

    // 1. [가시설] - 주요 부재 (모두 처리)
    console.log('[1] [가시설] 주요 부재\n');
    const gasiLines = dxf.entities.filter(e => e.layer === '가시설' && e.type === 'LINE');
    const gasiCircles = dxf.entities.filter(e => e.layer === '가시설' && e.type === 'CIRCLE');
    const gasiPolys = dxf.entities.filter(e => e.layer === '가시설' && e.type === 'LWPOLYLINE');

    // 원 처리 (기초 파일)
    gasiCircles.forEach((circle, idx) => {
      const geometry = new THREE.CylinderGeometry(250, 250, 2000, 16);
      const material = new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.7 });
      const mesh = new THREE.Mesh(geometry, material);

      const x = circle.center.x * SCALE;
      const y = circle.center.y * SCALE;
      mesh.position.set(x, y, 1000);

      const volume = Math.round(Math.PI * 250 * 250 * 2000 / 1e6);
      mesh.userData = {
        type: 'Foundation-Pile',
        spec: 'φ500×2000',
        dimensions: 'φ500×2000mm',
        volume: volume
      };

      scene.add(mesh);
      allParts.push(mesh.userData);
      totalVolume += volume;
    });

    console.log(`  원(파일): ${gasiCircles.length}개 추가`);

    // 선 처리 (버팀목/보)
    gasiLines.forEach((line, idx) => {
      if (!line.vertices || line.vertices.length < 2) return;

      const dx = (line.vertices[1].x - line.vertices[0].x) * SCALE;
      const dy = (line.vertices[1].y - line.vertices[0].y) * SCALE;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 500) { // 500mm 이상만
        const geometry = new THREE.BoxGeometry(200, 200, length);
        const material = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.7 });
        const mesh = new THREE.Mesh(geometry, material);

        const midX = ((line.vertices[0].x + line.vertices[1].x) / 2) * SCALE;
        const midY = ((line.vertices[0].y + line.vertices[1].y) / 2) * SCALE;
        mesh.position.set(midX, midY, length / 2);

        const volume = Math.round((200 * 200 * length) / 1e6);
        mesh.userData = {
          type: 'Strut',
          spec: '200×200',
          dimensions: `200×200×${Math.round(length)}mm`,
          volume: volume
        };

        scene.add(mesh);
        allParts.push(mesh.userData);
        totalVolume += volume;
      }
    });

    console.log(`  선(버팀목): ${gasiLines.filter(l => {
      const dx = (l.vertices[1].x - l.vertices[0].x) * SCALE;
      const dy = (l.vertices[1].y - l.vertices[0].y) * SCALE;
      return Math.sqrt(dx * dx + dy * dy) > 500;
    }).length}개 추가`);

    // 폴리라인 처리 (패널)
    gasiPolys.forEach((poly, idx) => {
      if (!poly.vertices || poly.vertices.length < 3) return;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      poly.vertices.forEach(pt => {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
      });

      const width = (maxX - minX) * SCALE;
      const height = (maxY - minY) * SCALE;

      if (width > 100 && height > 100) {
        const geometry = new THREE.BoxGeometry(width, height, 300);
        const material = new THREE.MeshStandardMaterial({ color: 0x7ed321, roughness: 0.7 });
        const mesh = new THREE.Mesh(geometry, material);

        const centerX = ((minX + maxX) / 2) * SCALE;
        const centerY = ((minY + maxY) / 2) * SCALE;
        mesh.position.set(centerX, centerY, 150);

        const volume = Math.round((width * height * 300) / 1e6);
        mesh.userData = {
          type: 'Retaining-Panel',
          dimensions: `${Math.round(width)}×${Math.round(height)}×300mm`,
          volume: volume
        };

        scene.add(mesh);
        allParts.push(mesh.userData);
        totalVolume += volume;
      }
    });

    console.log(`  폴리라인(패널): ${gasiPolys.length}개 추가`);

    // 2. [기존구조물] - 하천 구조물 (모두)
    console.log(`\n[2] [기존구조물] 하천 구조물\n`);
    const existLines = dxf.entities.filter(e => e.layer === '기존구조물' && e.type === 'LINE');

    const processedExist = existLines.filter(line => {
      if (!line.vertices || line.vertices.length < 2) return false;
      const dx = (line.vertices[1].x - line.vertices[0].x) * SCALE;
      const dy = (line.vertices[1].y - line.vertices[0].y) * SCALE;
      const length = Math.sqrt(dx * dx + dy * dy);
      return length > 1000;
    });

    processedExist.forEach((line) => {
      const dx = (line.vertices[1].x - line.vertices[0].x) * SCALE;
      const dy = (line.vertices[1].y - line.vertices[0].y) * SCALE;
      const length = Math.sqrt(dx * dx + dy * dy);

      const geometry = new THREE.BoxGeometry(200, 200, length);
      const material = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.7 });
      const mesh = new THREE.Mesh(geometry, material);

      const midX = ((line.vertices[0].x + line.vertices[1].x) / 2) * SCALE;
      const midY = ((line.vertices[0].y + line.vertices[1].y) / 2) * SCALE;
      mesh.position.set(midX, midY, length / 2);

      const volume = Math.round((200 * 200 * length) / 1e6);
      mesh.userData = {
        type: 'River-Structure',
        dimensions: `200×200×${Math.round(length)}mm`,
        volume: volume
      };

      scene.add(mesh);
      allParts.push(mesh.userData);
      totalVolume += volume;
    });

    console.log(`  대형 구조물: ${processedExist.length}개 추가`);

    // 3. [지질주상도] - 지질층 (모두)
    console.log(`\n[3] [지질주상도] 지질층\n`);
    const geoCircles = dxf.entities.filter(e => e.layer === '지질주상도' && e.type === 'CIRCLE');

    geoCircles.forEach((circle, idx) => {
      if (!circle.center) return;

      const geometry = new THREE.CylinderGeometry(150, 150, 500, 8);
      const material = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8 });
      const mesh = new THREE.Mesh(geometry, material);

      const x = circle.center.x * SCALE;
      const y = circle.center.y * SCALE;
      mesh.position.set(x, y, 250);

      const volume = Math.round(Math.PI * 150 * 150 * 500 / 1e6);
      mesh.userData = {
        type: 'Soil-Layer',
        diameter: 300,
        depth: 500,
        volume: volume
      };

      scene.add(mesh);
      allParts.push(mesh.userData);
      totalVolume += volume;
    });

    console.log(`  토층: ${geoCircles.length}개 추가`);

    // 4. [주상도] - 단면도 정보
    console.log(`\n[4] [주상도] 단면\n`);
    const sectionPolys = dxf.entities.filter(e => e.layer === '주상도' && e.type === 'LWPOLYLINE');
    const sectionCircles = dxf.entities.filter(e => e.layer === '주상도' && e.type === 'CIRCLE');

    sectionCircles.slice(0, 50).forEach((circle) => {
      if (!circle.center) return;

      const geometry = new THREE.CylinderGeometry(100, 100, 300, 8);
      const material = new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: 0.7 });
      const mesh = new THREE.Mesh(geometry, material);

      const x = circle.center.x * SCALE;
      const y = circle.center.y * SCALE;
      mesh.position.set(x, y, 150);

      mesh.userData = {
        type: 'Section-Marker',
        dimensions: '200×300mm',
        volume: 1
      };

      scene.add(mesh);
      allParts.push(mesh.userData);
    });

    console.log(`  단면표시: ${Math.min(50, sectionCircles.length)}개 추가`);

    // 통계
    console.log('\n=== 최종 통계 ===\n');
    console.log(`총 부재: ${allParts.length}개`);
    console.log(`총 부피: ${totalVolume}m³\n`);

    const typeCount = {};
    allParts.forEach(part => {
      const type = part.type;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    console.log('부재 구성:');
    Object.entries(typeCount).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}개`);
    });

    // 파일 저장
    console.log('\n=== 파일 저장 ===\n');

    const objPath = path.join('out', `${filename}-full.obj`);
    exportOBJ(scene, objPath);
    console.log(`  ✓ ${objPath}`);

    const volPath = path.join('out', `${filename}-full-volumes.json`);
    const volumeInfo = {
      timestamp: new Date().toISOString(),
      drawing: filename,
      method: 'Full-Layer-Analysis',
      totalVolume: totalVolume,
      partCount: allParts.length,
      scale: '1:120',
      parts: allParts,
      typeCount,
      status: 'COMPLETE'
    };

    fs.writeFileSync(volPath, JSON.stringify(volumeInfo, null, 2));
    console.log(`  ✓ ${volPath}\n`);

    console.log(`[generate-3d-lh-full] ✅ 상세 3D 모델 생성 완료!\n`);

  } catch (error) {
    console.error(`[generate-3d-lh-full] ❌ 오류: ${error.message}`);
    process.exit(1);
  }
}

function exportOBJ(scene, filename) {
  let objContent = '# DXF to 3D (LH Full Model)\n';
  objContent += `# Generated: ${new Date().toISOString()}\n\n`;

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
}

await generate3DLHFull('가시설계획_LH');
