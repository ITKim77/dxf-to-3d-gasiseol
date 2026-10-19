#!/usr/bin/env node
/**
 * test-clustering.mjs - 부재 클러스터링 테스트
 */

import DxfParser from 'dxf-parser';
import fs from 'fs';
import { clusterMembersFromLines, detectLengthPatterns } from './core/cluster-members.mjs';

async function testClustering() {
  try {
    console.log('=== 부재 자동 클러스터링 테스트 ===\n');

    const dxfContent = fs.readFileSync('RAG/가시설_평면.dxf', 'utf-8');
    const parser = new DxfParser();
    const dxf = parser.parse(dxfContent);

    // 테스트 1: A-GUJO01 클러스터링
    console.log('\n[Test 1] A-GUJO01 구조 부재\n');
    const gujoLines = dxf.entities.filter(e => e.layer === 'A-GUJO01' && e.type === 'LINE');
    console.log(`입력: ${gujoLines.length}개 선\n`);

    const gujoMembers = clusterMembersFromLines(gujoLines);

    console.log(`결과: ${gujoMembers.length}개 부재\n`);
    gujoMembers.forEach((m, i) => {
      console.log(`  부재 ${i}: ${m.type}`);
      console.log(`    - 선: ${m.clusterSize}개`);
      console.log(`    - 치수: ${m.dimensions.width}×${m.dimensions.height}×${m.dimensions.length}mm`);
      console.log(`    - 부피: ${m.volume}m³`);
      console.log(`    - 선 길이: ${m.lineDetails.map(l => l.length).join(', ')}mm`);
      console.log();
    });

    // 테스트 2: A-LINE04 클러스터링
    console.log('[Test 2] A-LINE04 버팀목\n');
    const line04Lines = dxf.entities.filter(e => e.layer === 'A-LINE04' && e.type === 'LINE');
    console.log(`입력: ${line04Lines.length}개 선\n`);

    const line04Members = clusterMembersFromLines(line04Lines);
    console.log(`결과: ${line04Members.length}개 부재\n`);

    // 테스트 3: A-BASE 기초선 클러스터링
    console.log('[Test 3] A-BASE 기초\n');
    const baseLines = dxf.entities.filter(e => e.layer === 'A-BASE' && e.type === 'LINE');
    console.log(`입력: ${baseLines.length}개 선\n`);

    const baseMembers = clusterMembersFromLines(baseLines);
    console.log(`결과: ${baseMembers.length}개 부재\n`);

    // 테스트 4: 길이 패턴 분석
    console.log('[Test 4] 길이 패턴 분석\n');
    detectLengthPatterns(gujoLines);

    // 결과 종합
    console.log('\n=== 최종 결과 ===\n');

    const totalMembers = gujoMembers.length + line04Members.length + baseMembers.length;
    const totalVolume = [gujoMembers, line04Members, baseMembers]
      .flat()
      .reduce((sum, m) => sum + m.volume, 0);

    console.log(`총 부재: ${totalMembers}개`);
    console.log(`총 부피: ${totalVolume}m³\n`);

    // 결과 저장
    const result = {
      timestamp: new Date().toISOString(),
      clustering: {
        'A-GUJO01': {
          inputLines: gujoLines.length,
          outputMembers: gujoMembers.length,
          members: gujoMembers
        },
        'A-LINE04': {
          inputLines: line04Lines.length,
          outputMembers: line04Members.length,
          members: line04Members
        },
        'A-BASE': {
          inputLines: baseLines.length,
          outputMembers: baseMembers.length,
          members: baseMembers
        }
      },
      summary: {
        totalMembers,
        totalVolume
      }
    };

    fs.writeFileSync('out/clustering-result.json', JSON.stringify(result, null, 2));
    console.log('✓ 결과 저장: out/clustering-result.json\n');

  } catch (error) {
    console.error(`❌ 오류: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

testClustering();
