#!/usr/bin/env node
/**
 * test-shapes.mjs - 형상 추출 테스트
 */

import DxfParser from 'dxf-parser';
import fs from 'fs';
import { extractShapes } from './core/extract-shapes.mjs';

async function testShapeExtraction() {
  try {
    console.log('=== 형상 추출 테스트 ===\n');

    // DXF 로드
    const dxfContent = fs.readFileSync('RAG/가시설_평면.dxf', 'utf-8');
    const parser = new DxfParser();
    const dxf = parser.parse(dxfContent);

    // IR 구성 (최소 구조)
    const ir = {
      dxf: {
        layerInfo: {
          'A-LINE01': dxf.entities.filter(e => e.layer === 'A-LINE01'),
          'A-LINE04': dxf.entities.filter(e => e.layer === 'A-LINE04'),
          'A-GUJO01': dxf.entities.filter(e => e.layer === 'A-GUJO01'),
          'A-CEN01': dxf.entities.filter(e => e.layer === 'A-CEN01'),
          'A-BASE': dxf.entities.filter(e => e.layer === 'A-BASE')
        }
      }
    };

    // 형상 추출
    const shapes = extractShapes(ir, dxf);

    // 결과 저장
    const result = {
      timestamp: new Date().toISOString(),
      summary: {
        panels: shapes.panels.length,
        struts: shapes.struts.length,
        hBeams: shapes.hBeams.length,
        centerPiles: shapes.centerPiles.length,
        foundationPiles: shapes.foundationPiles.length,
        foundationBeams: shapes.foundationBeams.length,
        totalParts: shapes.panels.length + shapes.struts.length + shapes.hBeams.length +
                   shapes.centerPiles.length + shapes.foundationPiles.length + shapes.foundationBeams.length
      },
      shapes
    };

    // 부피 계산
    let totalVolume = 0;
    Object.values(shapes).forEach(array => {
      if (Array.isArray(array)) {
        array.forEach(item => {
          if (item.volume) totalVolume += item.volume;
        });
      }
    });

    result.summary.totalVolume = totalVolume;

    // 출력
    console.log('\n=== 추출 결과 ===\n');
    console.log(`총 부재: ${result.summary.totalParts}개`);
    console.log(`  - 토류판: ${result.summary.panels}개`);
    console.log(`  - 버팀목: ${result.summary.struts}개`);
    console.log(`  - H-보: ${result.summary.hBeams}개`);
    console.log(`  - 센터 파일: ${result.summary.centerPiles}개`);
    console.log(`  - 기초 파일: ${result.summary.foundationPiles}개`);
    console.log(`  - 기초 보: ${result.summary.foundationBeams}개`);
    console.log(`\n총 부피: ${totalVolume.toFixed(2)} m³\n`);

    // 토류판 샘플
    if (shapes.panels.length > 0) {
      console.log('토류판 샘플 (첫 3개):');
      shapes.panels.slice(0, 3).forEach((p, i) => {
        console.log(`  [${i}] ${p.dimensions.width}×${p.dimensions.height}×${p.dimensions.thickness}mm`);
      });
    }

    // 버팀목 샘플
    if (shapes.struts.length > 0) {
      console.log('\n버팀목 샘플 (첫 3개):');
      shapes.struts.slice(0, 3).forEach((s, i) => {
        console.log(`  [${i}] 길이: ${s.length}mm, 부피: ${s.volume}m³`);
      });
    }

    // 기초 파일 샘플
    if (shapes.foundationPiles.length > 0) {
      console.log('\n기초 파일 샘플 (첫 3개):');
      shapes.foundationPiles.slice(0, 3).forEach((p, i) => {
        console.log(`  [${i}] φ${p.diameter}mm, 깊이: ${p.depth}mm, 부피: ${p.volume}m³`);
      });
    }

    // JSON 저장
    fs.writeFileSync('out/shape-extraction.json', JSON.stringify(result, null, 2));
    console.log('\n✓ 결과 저장: out/shape-extraction.json');

  } catch (error) {
    console.error(`❌ 오류: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

testShapeExtraction();
