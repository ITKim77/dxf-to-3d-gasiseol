#!/usr/bin/env node
/**
 * generate-3d-lh.mjs - LH 도면용 3D 모델 생성 (레이어 정리 버전)
 *
 * 특징: 레이어가 명확하게 정리되어 있음
 * - [가시설]: 주요 부재
 * - [가시설평면]: 상세 블록
 * - [기존구조물]: 하천 구조물
 * - [지질주상도]: 지질 정보
 */

import DxfParser from 'dxf-parser';
import * as THREE from 'three';
import * as fs from 'fs';
import * as path from 'path';

const SCALE = 120; // 축척 1:120 (LH 도면)

async function generate3DLH(filename = '가시설계획_LH') {
  console.log(`\n[generate-3d-lh] ${filename} - 3D 모델 생성\n`);

  try {
    // DXF 로드
    const dxfPath = path.join('RAG/LH', `${filename}.dxf`);
    const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
    const parser = new DxfParser();
    const dxf = parser.parse(dxfContent);

    console.log('=== 부재 추출 ===\n');

    const scene = new THREE.Scene();
    const allParts = [];
    let totalVolume = 0;

    // 1. [가시설] - 주요 부재
    console.log('[1] [가시설] 레이어 - 주요 부재\n');
    const gasiLines = dxf.entities.filter(e => e.layer === '가시설' && e.type === 'LINE');
    const gasiPolys = dxf.entities.filter(e => e.layer === '가시설' && e.type === 'LWPOLYLINE');

    console.log(`  선: ${gasiLines.length}개`);
    console.log(`  폴리라인: ${gasiPolys.length}개`);

    // 선들을 높이 순으로 그룹화 (단면)
    const heightGroups = {};
    gasiLines.forEach(line => {
      if (!line.vertices || line.vertices.length < 2) return;
      const y = Math.round(line.vertices[0].y / 500) * 500; // 500mm 단위로 그룹화
      const yKey = `Y${y}`;
      if (!heightGroups[yKey]) heightGroups[yKey] = [];
      heightGroups[yKey].push(line);
    });

    let memberCount = 0;
    Object.entries(heightGroups).slice(0, 20).forEach(([heightKey, lines]) => { // 상위 20개
      if (lines.length < 3) return;

      // 박스 부재로 표현
      const lengths = lines.map(l => {
        const dx = (l.vertices[1].x - l.vertices[0].x) * SCALE;
        const dy = (l.vertices[1].y - l.vertices[0].y) * SCALE;
        return Math.sqrt(dx * dx + dy * dy);
      });

      const avgLength = lengths.reduce((a, b) => a + b) / lengths.length;
      const maxLength = Math.max(...lengths);

      if (maxLength > 500) { // 500mm 이상만
        const geometry = new THREE.BoxGeometry(300, 300, maxLength);
        const material = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.7 });
        const mesh = new THREE.Mesh(geometry, material);

        const centerY = parseInt(heightKey.slice(1));
        const centerX = lines.reduce((sum, l) => sum + l.vertices[0].x, 0) / lines.length * SCALE;

        mesh.position.set(centerX, centerY, maxLength / 2);

        const volume = Math.round((300 * 300 * maxLength) / 1e6);
        mesh.userData = {
          type: 'Structural-Member',
          spec: '300×300 (추정)',
          dimensions: `300×300×${Math.round(maxLength)}mm`,
          volume: volume,
          lineCount: lines.length
        };

        scene.add(mesh);
        allParts.push(mesh.userData);
        totalVolume += volume;
        memberCount++;

        console.log(`  ✓ 부재 ${memberCount}: ${lines.length}개 선, ${volume}m³`);
      }
    });

    // 폴리라인도 처리
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

    // 2. [기존구조물] - 하천 구조물
    console.log(`\n[2] [기존구조물] - 하천 구조물\n`);
    const existLines = dxf.entities.filter(e => e.layer === '기존구조물' && e.type === 'LINE');
    console.log(`  선: ${existLines.length}개`);

    existLines.slice(0, 10).forEach((line, idx) => {
      if (!line.vertices || line.vertices.length < 2) return;

      const dx = (line.vertices[1].x - line.vertices[0].x) * SCALE;
      const dy = (line.vertices[1].y - line.vertices[0].y) * SCALE;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 1000 && idx < 20) { // 1000mm 이상, 처음 20개
        const geometry = new THREE.BoxGeometry(200, 200, length);
        const material = new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.7 });
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
      }
    });

    console.log(`  ✓ 처음 10개 대형 구조물 추가`);

    // 3. [지질주상도] - 지질층 (원 사용)
    console.log(`\n[3] [지질주상도] - 지질층\n`);
    const geoCircles = dxf.entities.filter(e => e.layer === '지질주상도' && e.type === 'CIRCLE');
    console.log(`  원: ${geoCircles.length}개`);

    geoCircles.slice(0, 30).forEach((circle, idx) => {
      if (!circle.center) return;

      const geometry = new THREE.CylinderGeometry(200, 200, 500, 8);
      const material = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.7 });
      const mesh = new THREE.Mesh(geometry, material);

      const x = circle.center.x * SCALE;
      const y = circle.center.y * SCALE;
      mesh.position.set(x, y, 250);

      const volume = Math.round(Math.PI * 200 * 200 * 500 / 1e6);
      mesh.userData = {
        type: 'Soil-Layer',
        diameter: 400,
        depth: 500,
        volume: volume
      };

      scene.add(mesh);
      allParts.push(mesh.userData);
      totalVolume += volume;
    });

    console.log(`  ✓ 지질층 30개 추가`);

    // 4. [가시설평면] - INSERT 블록 (상세)
    console.log(`\n[4] [가시설평면] - 상세 블록\n`);
    const blkInserts = dxf.entities.filter(e => e.layer === '가시설평면' && e.type === 'INSERT');
    console.log(`  INSERT: ${blkInserts.length}개`);
    console.log(`  ⓘ 블록 상세는 복잡하므로 위치만 표시`);

    blkInserts.slice(0, 20).forEach((insert, idx) => {
      if (!insert.position) return;

      // 작은 큐브로 표시 (블록 위치)
      const geometry = new THREE.BoxGeometry(200, 200, 200);
      const material = new THREE.MeshStandardMaterial({ color: 0x7ed321, roughness: 0.7 });
      const mesh = new THREE.Mesh(geometry, material);

      const x = insert.position.x * SCALE;
      const y = insert.position.y * SCALE;
      mesh.position.set(x, y, 100);

      mesh.userData = {
        type: 'Detail-Block',
        blockName: insert.name || 'Block',
        dimensions: '200×200×200mm',
        volume: Math.round((200 * 200 * 200) / 1e6)
      };

      scene.add(mesh);
      allParts.push(mesh.userData);
      totalVolume += mesh.userData.volume;
    });

    console.log(`  ✓ 블록 20개 추가`);

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

    // OBJ 내보내기
    const objPath = path.join('out', `${filename}-3d.obj`);
    exportOBJ(scene, objPath);
    console.log(`  ✓ ${objPath}`);

    // 부재 정보
    const volumeInfo = {
      timestamp: new Date().toISOString(),
      drawing: filename,
      method: 'Layer-Based-LH',
      totalVolume: totalVolume,
      partCount: allParts.length,
      scale: `1:${1/SCALE}`,
      parts: allParts.slice(0, 50), // 첫 50개만
      typeCount,
      status: 'READY_FOR_WEB'
    };

    const volPath = path.join('out', `${filename}-volumes.json`);
    fs.writeFileSync(volPath, JSON.stringify(volumeInfo, null, 2));
    console.log(`  ✓ ${volPath}\n`);

    console.log(`[generate-3d-lh] ✅ 3D 모델 생성 완료!\n`);

  } catch (error) {
    console.error(`[generate-3d-lh] ❌ 오류: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

function exportOBJ(scene, filename) {
  let objContent = '# DXF to 3D (LH Model)\n';
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

await generate3DLH('가시설계획_LH');
