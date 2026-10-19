/**
 * extract-specs.mjs - DXF 텍스트에서 부재 규격 추출
 *
 * 역할:
 * 1. DXF 텍스트 분석 (TEXT/MTEXT)
 * 2. 규격 패턴 인식 (H빔, 파일, 연결부 등)
 * 3. 부재별 규격 데이터베이스 생성
 */

export function extractSpecifications(ir) {
  console.log(`[extract-specs] DXF 텍스트에서 규격 추출 중...\n`);

  const specs = {
    beams: [],        // H빔, I빔 등
    piles: [],        // 기초파일 (원형, 사각형)
    connections: [],  // 연결부, 용접부
    materials: [],    // 재료 정보
    dimensions: [],   // 치수 정보
    notes: []         // 일반 주석
  };

  if (!ir.dimensions) {
    console.log(`[extract-specs] 텍스트 정보 없음\n`);
    return specs;
  }

  // 1. H빔/I빔 규격 추출
  const beamPatterns = [
    /H-?(\d+)\s*×\s*(\d+)\s*×\s*(\d+)\s*×\s*(\d+)/gi,  // H-300×300×10×15
    /H\s*(\d+)\s*×\s*(\d+)/gi,                            // H 300×300
    /I-?BEAM\s*(\d+)/gi                                   // I-BEAM 250
  ];

  // 2. 파일/기초 규격 추출
  const pilePatterns = [
    /[φ∅]\s*(\d+)/g,                           // φ1000, ∅1000
    /PILE\s*(\d+)/gi,                          // PILE 1000
    /기초\s*(\d+)/g,                            // 기초 1000
    /파일\s*(\d+)/g,                            // 파일 1000
    /Ø\s*(\d+)/g,                              // Ø1000
  ];

  // 3. 연결부 규격
  const connectionPatterns = [
    /볼트\s*M(\d+)/g,                          // 볼트 M20
    /BOLT\s*M(\d+)/gi,                         // BOLT M20
    /용접\s*(\d+)/g,                            // 용접 10mm
    /WELD\s*(\d+)/gi,                          // WELD 10
    /연결\s*([가-힣\w]+)/g                      // 연결 정보
  ];

  // 모든 텍스트 수집
  const allTexts = [];
  for (const [layer, dim] of Object.entries(ir.dimensions)) {
    if (dim.text) {
      allTexts.push({
        text: dim.text,
        layer,
        position: dim.position
      });
    }
  }

  console.log(`[extract-specs] 총 ${allTexts.length}개 텍스트 항목\n`);

  // H빔 규격 추출
  console.log(`[extract-specs] H빔/I빔 규격 추출:\n`);
  allTexts.forEach(item => {
    for (const pattern of beamPatterns) {
      let match;
      while ((match = pattern.exec(item.text))) {
        const spec = {
          type: 'H-Beam',
          layer: item.layer,
          original: match[0],
          width: parseInt(match[1]) || null,
          height: parseInt(match[2]) || null,
          webThickness: parseInt(match[3]) || null,
          flangeThickness: parseInt(match[4]) || null,
          source: item.text
        };

        specs.beams.push(spec);
        console.log(`  ✓ ${match[0].padEnd(20)} [${item.layer}] ${item.text.substring(0, 40)}`);
      }
    }
  });

  // 파일 규격 추출
  console.log(`\n[extract-specs] 기초파일 규격 추출:\n`);
  allTexts.forEach(item => {
    for (const pattern of pilePatterns) {
      let match;
      while ((match = pattern.exec(item.text))) {
        const spec = {
          type: 'Pile',
          layer: item.layer,
          original: match[0],
          diameter: parseInt(match[1]) || null,
          source: item.text
        };

        // 중복 제거
        if (!specs.piles.some(p => p.original === spec.original && p.layer === spec.layer)) {
          specs.piles.push(spec);
          console.log(`  ✓ ${match[0].padEnd(20)} [${item.layer}] ${item.text.substring(0, 40)}`);
        }
      }
    }
  });

  // 연결부 정보 추출
  console.log(`\n[extract-specs] 연결부 정보 추출:\n`);
  allTexts.forEach(item => {
    for (const pattern of connectionPatterns) {
      let match;
      while ((match = pattern.exec(item.text))) {
        const spec = {
          type: 'Connection',
          layer: item.layer,
          original: match[0],
          detail: match[1] || null,
          source: item.text
        };

        specs.connections.push(spec);
        console.log(`  ✓ ${match[0].padEnd(30)} [${item.layer}]`);
      }
    }
  });

  // 기타 정보
  console.log(`\n[extract-specs] 기타 정보:\n`);
  allTexts.forEach(item => {
    if (item.text.includes('재료') || item.text.includes('MATERIAL') ||
        item.text.includes('강') || item.text.includes('콘크리트')) {
      specs.materials.push({
        text: item.text,
        layer: item.layer
      });
      console.log(`  ✓ 재료: ${item.text}`);
    }
  });

  // 요약
  console.log(`\n[extract-specs] 추출 결과:\n`);
  console.log(`  H빔: ${specs.beams.length}개`);
  console.log(`  파일: ${specs.piles.length}개`);
  console.log(`  연결부: ${specs.connections.length}개`);
  console.log(`  재료: ${specs.materials.length}개\n`);

  return specs;
}

// 레이어별 부재 매핑
export function mapLayersToMembers(ir, specs) {
  console.log(`[extract-specs] 레이어별 부재 매핑:\n`);

  const members = {
    structural_beams: [],
    foundation_piles: [],
    secondary_beams: [],
    slope_elements: [],
    connections: []
  };

  // 레이어 정보
  const layerInfo = ir.dxf?.layerInfo || {};

  // A-GUJO01: 구조 보
  if (layerInfo['A-GUJO01']) {
    const lineCount = layerInfo['A-GUJO01'].filter(e => e.type === 'LINE').length;
    const beamSpec = specs.beams[0]; // 첫 번째 H빔 규격 사용

    members.structural_beams = {
      layer: 'A-GUJO01',
      type: 'H-Beam',
      spec: beamSpec,
      estimatedCount: Math.max(1, Math.round(lineCount / 5)), // 선 5개당 1개 부재
      entityCount: lineCount,
      note: `LINE ${lineCount}개 → 추정 ${Math.max(1, Math.round(lineCount / 5))}개 부재`
    };

    console.log(`  A-GUJO01 (구조보):`);
    console.log(`    규격: ${beamSpec?.original || 'H-300×300'}`);
    console.log(`    선 개수: ${lineCount}`);
    console.log(`    추정 부재: ${members.structural_beams.estimatedCount}개`);
  }

  // A-BASE: 기초 파일
  if (layerInfo['A-BASE']) {
    const circleCount = layerInfo['A-BASE'].filter(e => e.type === 'CIRCLE').length;
    const pileSpec = specs.piles[0]; // 첫 번째 파일 규격 사용

    members.foundation_piles = {
      layer: 'A-BASE',
      type: 'Pile',
      spec: pileSpec,
      count: circleCount,
      diameter: pileSpec?.diameter || 1000,
      note: `CIRCLE ${circleCount}개 = ${circleCount}개 파일`
    };

    console.log(`\n  A-BASE (기초파일):`);
    console.log(`    규격: ${pileSpec?.original || 'φ1000'}`);
    console.log(`    원 개수: ${circleCount}`);
    console.log(`    파일 개수: ${circleCount}개`);
  }

  // A-LINE04: 보조 보
  if (layerInfo['A-LINE04']) {
    const lineCount = layerInfo['A-LINE04'].filter(e => e.type === 'LINE').length;

    members.secondary_beams = {
      layer: 'A-LINE04',
      type: 'Secondary-Beam',
      spec: { type: 'H-Beam', width: 250, height: 250 },
      estimatedCount: Math.max(1, Math.round(lineCount / 4)),
      entityCount: lineCount,
      note: `LINE ${lineCount}개 → 추정 ${Math.max(1, Math.round(lineCount / 4))}개 부재`
    };

    console.log(`\n  A-LINE04 (보조보):`);
    console.log(`    규격: H-250×250 (추정)`);
    console.log(`    선 개수: ${lineCount}`);
    console.log(`    추정 부재: ${members.secondary_beams.estimatedCount}개`);
  }

  // A-SLOPE: 사면
  if (layerInfo['A-SLOPE']) {
    const lineCount = layerInfo['A-SLOPE'].filter(e => e.type === 'LINE').length;

    members.slope_elements = {
      layer: 'A-SLOPE',
      type: 'Slope',
      elementCount: lineCount,
      note: `선 ${lineCount}개 (사면 강화)`
    };

    console.log(`\n  A-SLOPE (사면):`);
    console.log(`    구성요소: ${lineCount}개`);
  }

  console.log(`\n[extract-specs] 매핑 완료\n`);

  return members;
}

// 규격 데이터베이스 생성
export function createSpecDatabase(specs, members) {
  console.log(`[extract-specs] 규격 데이터베이스 생성:\n`);

  const database = {
    timestamp: new Date().toISOString(),
    specifications: specs,
    members,
    summary: {
      totalBeamTypes: specs.beams.length,
      totalPileTypes: specs.piles.length,
      estimatedStructuralBeams: members.structural_beams?.estimatedCount || 0,
      foundationPiles: members.foundation_piles?.count || 0,
      secondaryBeams: members.secondary_beams?.estimatedCount || 0
    }
  };

  return database;
}
