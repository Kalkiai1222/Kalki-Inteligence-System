/**
 * End-to-End Blueprint Processing Test
 * Tests: 2D extraction → Geometry detection → 3D generation → Takeoff calculation
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function testBlueprintPipeline() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   End-to-End Blueprint Processing Test (Local)         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Find a test PDF
  const testPdfDir = 'public/uploads/projects';
  let testPdfPath = null;
  
  if (fs.existsSync(testPdfDir)) {
    const dirs = fs.readdirSync(testPdfDir);
    for (const dir of dirs) {
      const files = fs.readdirSync(path.join(testPdfDir, dir));
      const pdf = files.find(f => f.endsWith('.pdf'));
      if (pdf) {
        testPdfPath = path.join(testPdfDir, dir, pdf);
        break;
      }
    }
  }

  if (!testPdfPath) {
    console.error('❌ No test PDFs found in public/uploads/projects/');
    process.exit(1);
  }

  console.log(`✓ Found test PDF: ${testPdfPath}`);
  console.log(`  File size: ${(fs.statSync(testPdfPath).size / 1024).toFixed(2)} KB\n`);

  // Test 1: Run Ingestion (2D extraction)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STAGE 1: 2D Ingestion (Extract lines, paths, text)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let ingestionData = null;
  try {
    const result = await runPythonScript('scripts/process_blueprint.py', [testPdfPath]);
    ingestionData = JSON.parse(result);
    
    if (ingestionData.status === 'success') {
      const data = ingestionData.data;
      console.log('✅ Ingestion PASSED');
      console.log(`   - Lines extracted: ${data.lines?.length || 0}`);
      console.log(`   - Paths extracted: ${data.paths?.length || 0}`);
      console.log(`   - Text elements: ${data.text?.length || 0}`);
      console.log(`   - Dimensions found: ${data.dimensions?.length || 0}`);
      console.log(`   - Notes/annotations: ${(data.notes?.length || 0) + (data.annotations?.length || 0)}`);
    } else {
      console.log('❌ Ingestion FAILED:', ingestionData.error);
      process.exit(1);
    }
  } catch (err) {
    console.log('❌ Ingestion script error:', err.message);
    process.exit(1);
  }

  // Test 2: Run Geometry Detection
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STAGE 2: Geometry Detection (Walls, rooms, scale)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let geometryData = null;
  try {
    const input = JSON.stringify(ingestionData.data || {});
    const result = await runPythonScript('scripts/extract_geometry.py', [], input);
    geometryData = JSON.parse(result);
    
    if (geometryData && !geometryData.error) {
      console.log('✅ Geometry Detection PASSED');
      console.log(`   - Walls detected: ${geometryData.walls?.length || 0}`);
      console.log(`   - Rooms detected: ${geometryData.rooms?.length || 0}`);
      console.log(`   - Openings found: ${geometryData.openings?.length || 0}`);
      console.log(`   - Scale multiplier: ${geometryData.scale?.multiplier || 'unknown'}`);
    } else {
      console.log('❌ Geometry Detection FAILED:', geometryData?.error || 'unknown error');
      process.exit(1);
    }
  } catch (err) {
    console.log('❌ Geometry script error:', err.message);
    process.exit(1);
  }

  // Test 3: Run 3D Generation + Takeoff
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STAGE 3: 3D Reconstruction + Material Takeoff');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let model3DData = null;
  try {
    const payload = {
      walls: geometryData.walls || [],
      rooms: geometryData.rooms || [],
      notes: ingestionData.data?.notes || [],
      text: ingestionData.data?.text || [],
      settings: geometryData.settingsUsed || {}
    };
    const input = JSON.stringify(payload);
    const result = await runPythonScript('scripts/generate_3d.py', [], input);
    model3DData = JSON.parse(result);
    
    if (model3DData.status === 'success') {
      console.log('✅ 3D Generation + Takeoff PASSED');
      console.log(`   - OBJ model: ${model3DData.obj ? '✓ Generated' : '✗ Missing'}`);
      console.log(`   - STEP file: ${model3DData.step ? '✓ Generated' : '✗ Missing'}`);
      console.log(`   - USD model: ${model3DData.usd ? '✓ Generated' : '✗ Missing'}`);
      
      if (model3DData.takeoff) {
        const t = model3DData.takeoff;
        console.log(`\n   📊 Takeoff Calculations:`);
        console.log(`      - Wall surface area: ${t.wallSurfaceArea || 'N/A'} sq ft`);
        console.log(`      - Floor/ceiling area: ${t.floorCeilingArea || 'N/A'} sq ft`);
        console.log(`      - Volume: ${t.volume || 'N/A'} cu ft`);
        console.log(`      - Drywall panels: ${t.drywallPanels || 'N/A'}`);
        console.log(`      - Studs: ${t.studs || 'N/A'}`);
        console.log(`      - Paint gallons: ${t.paintGallons || 'N/A'}`);
        console.log(`      - Insulation: ${t.insulation?.type || 'Not detected'}`);
      }
    } else {
      console.log('❌ 3D Generation FAILED:', model3DData.error);
      process.exit(1);
    }
  } catch (err) {
    console.log('❌ 3D script error:', err.message);
    process.exit(1);
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                  SUMMARY                               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log('✅ ALL STAGES COMPLETED SUCCESSFULLY!\n');
  console.log('Pipeline Flow Verified:');
  console.log('  1. PDF → 2D Extraction (lines, paths, text)');
  console.log('  2. 2D Data → Geometry Detection (walls, rooms, scale)');
  console.log('  3. Geometry → 3D Models + Takeoff (materials, insulation)\n');
  
  console.log('Ready to test in browser:');
  console.log('  1. Go to http://localhost:3000');
  console.log('  2. Create a project');
  console.log('  3. Upload a blueprint PDF');
  console.log('  4. Verify 2D viewer, 3D viewer, and takeoff panel show data\n');
}

function runPythonScript(scriptPath, args = [], stdinInput = null) {
  return new Promise((resolve, reject) => {
    const pythonExe = process.platform === 'win32'
      ? path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
      : path.join(process.cwd(), '.venv', 'bin', 'python');

    const python = fs.existsSync(pythonExe) ? pythonExe : 'python3';

    const proc = spawn(python, [scriptPath, ...args], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 180000 // 3 minutes
    });

    let stdout = '';
    let stderr = '';

    if (stdinInput) {
      proc.stdin.write(stdinInput);
      proc.stdin.end();
    }

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[Python stderr] ${data.toString().trim()}`);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

testBlueprintPipeline().then(() => {
  console.log('✅ Test completed successfully!');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
