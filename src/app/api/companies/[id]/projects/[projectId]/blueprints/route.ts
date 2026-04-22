import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

function sha256File(path: string): string {
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex');
}

function validateObjContent(content: string): { isValid: boolean; error: string | null } {
  const vertices = content.split('\n').filter((line) => line.startsWith('v ')).length;
  const faces = content.split('\n').filter((line) => line.startsWith('f ')).length;
  if (vertices <= 0 || faces <= 0) return { isValid: false, error: 'OBJ missing vertices or faces' };
  return { isValid: true, error: null };
}

function validateUsdContent(content: string): { isValid: boolean; error: string | null } {
  const isValid = content.includes('#usda') || content.includes('def Mesh');
  return { isValid, error: isValid ? null : 'USD content failed basic validation' };
}

function validateStepPath(path: string): { isValid: boolean; error: string | null } {
  if (!path.toLowerCase().endsWith('.step')) return { isValid: false, error: 'STEP file must use .step extension' };
  const content = existsSync(path) ? readFileSync(path, 'utf-8') : '';
  const isValid = content.includes('ISO-10303');
  return { isValid, error: isValid ? null : 'STEP header missing ISO-10303 signature' };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string, projectId: string }> }) {
  const { id, projectId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: Object(auth).userId } }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const project = await prisma.project.findFirst({ where: { id: projectId, companyId: id } });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const payloads = await req.json();
    if (!Array.isArray(payloads)) return NextResponse.json({ error: 'Payload must be an array of blueprint versions' }, { status: 400 });

    const createdSets = [];
    
    for (const item of payloads) {
       let { name, fileUrl, fileKey, fileSize, mimeType, fileHash, notes } = item;
       if (!name || !fileUrl) throw new Error('Name and fileUrl are strictly required');

       let localPath = '';
       let isTemp = false;

       // Attempt to locate the file for processing
       if (fileUrl.startsWith('/uploads/')) {
          localPath = join(process.cwd(), 'public', fileUrl);
       } else {
          // It's a remote URL (like S3), download temporarily
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error(`Could not fetch file from ${fileUrl}`);
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          localPath = join(tmpdir(), `${uuidv4()}.pdf`);
          await writeFile(localPath, buffer);
          isTemp = true;
       }

       // Run the ingestion python script via PyMuPDF/OpenCV
       const pyScript = join(process.cwd(), 'scripts', 'process_blueprint.py');
       // Using the virtual env python executable
       const pythonExe = process.platform === 'win32' 
            ? join(process.cwd(), '.venv', 'Scripts', 'python.exe')
            : join(process.cwd(), '.venv', 'bin', 'python');

       let blueprintData = null;
       try {
           const output = execFileSync(pythonExe, [pyScript, localPath], { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
           blueprintData = JSON.parse(output);
       } catch (err: any) {
           console.error('Python ingestion failed:', err.stdout || err.message);
           // if python fails we'll still save the file, but without extracted blueprintData
       }

       let geometryData: any = null;
       let model3DData: any = null;
       if (blueprintData && blueprintData.status === 'success') {
           const geomScript = join(process.cwd(), 'scripts', 'extract_geometry.py');
           try {
               const geomOutput = execFileSync(pythonExe, [geomScript], {
                   input: JSON.stringify({ 
                       ...blueprintData.data, 
                       companyId: id,
                       manualScale: item.manualScale || undefined,
                       settings: item.settings || {}
                   }),
                   encoding: 'utf-8',
                   maxBuffer: 50 * 1024 * 1024
               });
               geometryData = JSON.parse(geomOutput);

               // Generate 3D Reconstruction
               const model3DScript = join(process.cwd(), 'scripts', 'generate_3d.py');
               const model3DOutput = execFileSync(pythonExe, [model3DScript], {
                   input: JSON.stringify({ 
                       walls: geometryData.walls || [],
                       rooms: geometryData.rooms || [],
                       notes: blueprintData.data.notes || [],
                       text: blueprintData.data.text || [],
                       settings: {
                           ...(item.settings || {}),
                           ...geometryData.settingsUsed
                       }
                   }),
                   env: { ...process.env },
                   encoding: 'utf-8',
                   maxBuffer: 50 * 1024 * 1024
               });
               model3DData = JSON.parse(model3DOutput);
           } catch (err: any) {
               console.error('Python calculation failed:', err.stdout || err.message);
           }
       }

       if (isTemp) {
          try { await unlink(localPath); } catch (e) {}
       }

       // Store derived artifacts locally with deterministic names.
       let objUrl = null;
       let stepUrl = null;
       let usdUrl = null;
       let objPath: string | null = null;
       let stepPath: string | null = null;
       let usdPath: string | null = null;

       if (model3DData && model3DData.status === 'success') {
          const uploadsDir = join(process.cwd(), 'public', 'uploads', 'models');
          try { await mkdir(uploadsDir, { recursive: true }); } catch(e) {}
          
          if (model3DData.obj) {
            const objFilename = `${fileHash}-model.obj`;
            objPath = join(uploadsDir, objFilename);
            await writeFile(objPath, model3DData.obj);
            objUrl = `/uploads/models/${objFilename}`;
          }

          if (model3DData.step) {
            const stepFilename = `${fileHash}-model.step`;
            stepPath = join(uploadsDir, stepFilename);
            await writeFile(stepPath, model3DData.step);
            stepUrl = `/uploads/models/${stepFilename}`;
          }

          if (model3DData.usd) {
            const usdFilename = `${fileHash}-model.usda`;
            usdPath = join(uploadsDir, usdFilename);
            await writeFile(usdPath, model3DData.usd);
            usdUrl = `/uploads/models/${usdFilename}`;
          }
       }

       // Now store to DB
       const blueprintSet = await prisma.blueprintSet.create({
          data: {
            projectId,
            name,
            versions: {
              create: {
                versionNumber: 1,
                fileUrl,
                fileKey,
                fileSize,
                mimeType,
                fileHash,
                notes,
                ...(blueprintData && blueprintData.status === 'success' ? {
                  blueprintData: {
                    create: {
                      lines: JSON.stringify(blueprintData.data.lines || []),
                      paths: JSON.stringify(blueprintData.data.paths || []),
                      text: JSON.stringify(blueprintData.data.text || []),
                      dimensions: JSON.stringify(blueprintData.data.dimensions || []),
                      notes: JSON.stringify(blueprintData.data.notes || []),
                      annotations: JSON.stringify(blueprintData.data.annotations || [])
                    }
                  }
                } : {}),
                ...(geometryData ? {
                  geometryData: {
                    create: {
                      walls: JSON.stringify(geometryData.walls || []),
                      rooms: JSON.stringify(geometryData.rooms || []),
                      openings: JSON.stringify(geometryData.openings || []),
                      zones: JSON.stringify(geometryData.zones || [])
                    }
                  }
                } : {}),
                ...((objUrl || stepUrl || usdUrl) ? {
                  blueprint3DModel: {
                    create: {
                      objUrl,
                      stepUrl,
                      usdUrl
                    }
                  }
                } : {}),
                ...(model3DData && model3DData.takeoff ? {
                  takeoffResult: {
                    create: {
                      wallSurfaceArea: model3DData.takeoff.wallSurfaceArea,
                      floorCeilingArea: model3DData.takeoff.floorCeilingArea,
                      volume: model3DData.takeoff.volume,
                      drywallPanels: model3DData.takeoff.drywallPanels,
                      studs: model3DData.takeoff.studs,
                      paintGallons: model3DData.takeoff.paintGallons,
                      wasteFactor: model3DData.takeoff.wasteFactor,
                      insulationData: model3DData.takeoff.insulation ? JSON.stringify(model3DData.takeoff.insulation) : null
                    }
                  }
                } : {})
              }
            }
          },
          include: { versions: { include: { blueprintData: true, geometryData: true, blueprint3DModel: true, takeoffResult: true } } }
       });
       const createdVersion = blueprintSet.versions[0];

       if (model3DData?.takeoff?.perWallDetails && Array.isArray(model3DData.takeoff.perWallDetails)) {
        await prisma.reasoningTrace.deleteMany({
          where: { projectId, blueprintVersionId: createdVersion.id },
        });
        for (const detail of model3DData.takeoff.perWallDetails) {
          const wallId = `wall_${detail.wallIndex}`;
          await prisma.reasoningTrace.create({
            data: {
              companyId: id,
              projectId,
              blueprintVersionId: createdVersion.id,
              wallId,
              classification: detail.classification || 'unknown',
              sourceReference: detail.notes || 'takeoff.perWallDetails',
              confidence: detail.confidence ?? 0.8,
              reasoning: detail.notes || 'Derived from 3D wall geometry and note parsing',
              lineItems: JSON.stringify(detail),
            },
          });
        }
       }

       const job = await prisma.job.create({
        data: {
          projectId,
          blueprintVersionId: createdVersion.id,
          name: `Process ${name}`,
          description: `Pipeline run for ${name}`,
          status: 'export_ready',
          startDate: new Date(),
          endDate: new Date(),
        },
       });
       await prisma.jobStatusEvent.createMany({
        data: [
          { jobId: job.id, status: 'uploaded' },
          { jobId: job.id, status: 'processing' },
          { jobId: job.id, status: 'geometry_ready' },
          { jobId: job.id, status: 'quality_check' },
          { jobId: job.id, status: 'export_ready' },
        ],
       });

       if (objPath && objUrl) {
        const validation = validateObjContent(model3DData?.obj || '');
        await prisma.exportArtifact.create({
          data: {
            jobId: job.id,
            blueprintVersionId: createdVersion.id,
            artifactType: 'obj',
            filePath: objPath,
            fileSizeBytes: existsSync(objPath) ? readFileSync(objPath).byteLength : 0,
            sha256Hash: sha256File(objPath),
            isValid: validation.isValid,
            validationError: validation.error,
          },
        });
       }
       if (stepPath && stepUrl) {
        const validation = validateStepPath(stepPath);
        await prisma.exportArtifact.create({
          data: {
            jobId: job.id,
            blueprintVersionId: createdVersion.id,
            artifactType: 'step',
            filePath: stepPath,
            fileSizeBytes: existsSync(stepPath) ? readFileSync(stepPath).byteLength : 0,
            sha256Hash: sha256File(stepPath),
            isValid: validation.isValid,
            validationError: validation.error,
          },
        });
       }
       if (usdPath && usdUrl) {
        const validation = validateUsdContent(model3DData?.usd || '');
        await prisma.exportArtifact.create({
          data: {
            jobId: job.id,
            blueprintVersionId: createdVersion.id,
            artifactType: 'usd',
            filePath: usdPath,
            fileSizeBytes: existsSync(usdPath) ? readFileSync(usdPath).byteLength : 0,
            sha256Hash: sha256File(usdPath),
            isValid: validation.isValid,
            validationError: validation.error,
          },
        });
       }

       createdSets.push({ ...blueprintSet, jobId: job.id });
    }
    
    return NextResponse.json({ blueprintSets: createdSets }, { status: 201 });
  } catch (err: any) {
    console.error("Blueprint upload error", err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
