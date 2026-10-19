#!/usr/bin/env node
/**
 * generate-3d-final.mjs - 최종 정확한 3D 모델 생성 (클러스터링 기반)
 *
 * 입력: 자동 클러스터링된 부재 정보
 * 출력: Three.js OBJ 파일 + 웹 뷰어 데이터
 */

import DxfParser from 'dxf-parser';
import * as THREE from 'three';
import * as fs from 'fs';
import * as path from 'path';
import { clusterMembersFromLines } from '../core/cluster-members.mjs';

async function generate3DFinal(drawingName) {
  console.log(`[generate-3d-final] ${drawingName} - 최종 정확한 3D 모델 생성\n`);

  try {
    // DXF 로드
    const dxfPath = path.join('RAG', '가시설_평면.dxf');
    const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
    const parser = new DxfParser();
    const dxf = parser.parse(dxfContent);

    console.log('=== 부재 추출 ===\n');

    const scene = new THREE.Scene();
    const allParts = [];

    // 1. A-GUJO01: 구조 부재 (클러스터링)
    console.log('[1] A-GUJO01 구조 부재\n');
    const gujoLines = dxf.entities.filter(e => e.layer === 'A-GUJO01' && e.type === 'LINE');
    const gujoMembers = clusterMembersFromLines(gujoLines);

    gujoMembers.forEach((member, idx) => {
      // 간단한 박스로 표현 (실제 H-보의 근사)
      const geometry = new THREE.BoxGeometry(300, 300, member.dimensions.length);
      const material = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.7 });
      const mesh = new THREE.Mesh(geometry, material);

      // 위치 설정 (경계의 중심)
      const centerX = (parseInt(member.bounds.minX) + parseInt(member.bounds.maxX)) / 2;
      const centerY = (parseInt(member.bounds.minY) + parseInt(member.bounds.maxY)) / 2;
      mesh.position.set(centerX, centerY, member.dimensions.length / 2);

      mesh.userData = {
        type: 'Structural-Beam',
        spec: member.spec,
        dimensions: `${member.dimensions.width}×${member.dimensions.height}×${member.dimensions.length}mm`,
        volume: member.volume
      };

      scene.add(mesh);
      allParts.push(mesh.userData);
      console.log(`  ✓ H-보 ${idx}: 부피 ${member.volume}m³`);
    });

    // 2. A-BASE: 기초 파일 (원)
    console.log('\n[2] A-BASE 기초 파일\n');
    const baseCircles = dxf.entities.filter(e => e.layer === 'A-BASE' && e.type === 'CIRCLE');

    baseCircles.forEach((circle, idx) => {
      if (!circle.center) return;

      const geometry = new THREE.CylinderGeometry(500, 500, 8000, 16);
      const material = new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.7 });
      const mesh = new THREE.Mesh(geometry, material);

      const x = circle.center.x * 200;
      const y = circle.center.y * 200;
      mesh.position.set(x, y, 4000);

      mesh.userData = {
        type: 'Foundation-Pile',
        spec: 'φ1000×8000',
        dimensions: 'φ1000×8000mm',
        volume: 6283
      };

      scene.add(mesh);
      allParts.push(mesh.userData);
    });

    console.log(`  ✓ 파일 ${baseCircles.length}개 추가`);

    // 3. A-LINE01: 토류판 (폴리라인)
    console.log('\n[3] A-LINE01 토류판\n');
    const line01Polys = dxf.entities.filter(e => e.layer === 'A-LINE01' && e.type === 'LWPOLYLINE');

    let panelCount = 0;
    line01Polys.forEach((poly, idx) => {
      if (!poly.vertices || poly.vertices.length < 3) return;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      poly.vertices.forEach(pt => {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
      });

      const width = (maxX - minX) * 200;
      const height = (maxY - minY) * 200;

      // 더 정확한 필터 (10mm 이상)
      if (width > 10 && height > 10) {
        const geometry = new THREE.BoxGeometry(Math.max(width, 10), Math.max(height, 10), 300);
        const material = new THREE.MeshStandardMaterial({ color: 0x7ed321, roughness: 0.7 });
        const mesh = new THREE.Mesh(geometry, material);

        const centerX = ((minX + maxX) / 2) * 200;
        const centerY = ((minY + maxY) / 2) * 200;
        mesh.position.set(centerX, centerY, 150);

        const vol = Math.round((width * height * 300) / 1e6);
        mesh.userData = {
          type: 'Retaining-Wall-Panel',
          spec: `${Math.round(width)}×${Math.round(height)}×300`,
          dimensions: `${Math.round(width)}×${Math.round(height)}×300mm`,
          volume: vol
        };

        scene.add(mesh);
        allParts.push(mesh.userData);
        panelCount++;
      }
    });

    console.log(`  ✓ 토류판 ${panelCount}개 추가`);

    // 4. A-CEN01: 센터 파일
    console.log('\n[4] A-CEN01 센터 부재\n');
    const cenLines = dxf.entities.filter(e => e.layer === 'A-CEN01' && e.type === 'LINE');

    cenLines.forEach((line, idx) => {
      if (!line.vertices || line.vertices.length < 2) return;

      const start = line.vertices[0];
      const end = line.vertices[1];
      const dx = (end.x - start.x) * 200;
      const dy = (end.y - start.y) * 200;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 500) {
        const geometry = new THREE.BoxGeometry(200, 200, length);
        const material = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.7 });
        const mesh = new THREE.Mesh(geometry, material);

        const midX = ((start.x + end.x) / 2) * 200;
        const midY = ((start.y + end.y) / 2) * 200;
        mesh.position.set(midX, midY, length / 2);

        mesh.userData = {
          type: 'Center-Pile',
          spec: 'H-200×200',
          dimensions: `200×200×${Math.round(length)}mm`,
          volume: Math.round((200 * 200 * length) / 1e6)
        };

        scene.add(mesh);
        allParts.push(mesh.userData);
      }
    });

    console.log(`  ✓ 센터 부재 ${cenLines.length}개 추가`);

    // 5. A-SLOPE: 사면
    console.log('\n[5] A-SLOPE 사면\n');
    const slopeLines = dxf.entities.filter(e => e.layer === 'A-SLOPE' && e.type === 'LINE');
    console.log(`  ⓘ 사면: ${slopeLines.length}개 선 (상세 분석 필요)`);

    // 통계
    console.log('\n=== 최종 통계 ===\n');
    let totalVolume = 0;
    const typeCount = {};

    allParts.forEach(part => {
      totalVolume += part.volume;
      const type = part.type;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    console.log(`총 부재: ${allParts.length}개`);
    console.log(`총 부피: ${totalVolume.toFixed(0)} m³\n`);

    console.log('부재 구성:');
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}개`);
    });

    // OBJ 내보내기
    console.log('\n=== 파일 저장 ===\n');

    const objPath = path.join('out', `${drawingName}-final.obj`);
    exportOBJ(scene, objPath);
    console.log(`  ✓ ${objPath}`);

    // 부재 정보 저장
    const volumeInfo = {
      timestamp: new Date().toISOString(),
      drawing: drawingName,
      method: 'DXF-Clustering-Based',
      totalVolume: totalVolume.toFixed(2),
      partCount: allParts.length,
      parts: allParts,
      typeCount,
      status: 'CLUSTERING_BASED'
    };

    const volPath = path.join('out', `${drawingName}-volumes-final.json`);
    fs.writeFileSync(volPath, JSON.stringify(volumeInfo, null, 2));
    console.log(`  ✓ ${volPath}\n`);

    console.log(`[generate-3d-final] ✅ 최종 3D 모델 생성 완료!\n`);
    return volumeInfo;

  } catch (error) {
    console.error(`[generate-3d-final] ❌ 오류: ${error.message}`);
    process.exit(1);
  }
}

// OBJ 내보내기
function exportOBJ(scene, filename) {
  let objContent = '# DXF to 3D (Clustering-Based Final Model)\n';
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

const drawingName = process.argv[2] || 'gasiseol';
await generate3DFinal(drawingName);
