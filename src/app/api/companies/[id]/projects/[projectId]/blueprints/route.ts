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
import os from 'os';

const INGESTION_TIMEOUT_MS = Number(process.env.PIPELINE_INGESTION_TIMEOUT_MS || 900000);
const GEOMETRY_TIMEOUT_MS = Number(process.env.PIPELINE_GEOMETRY_TIMEOUT_MS || 300000);
const RECONSTRUCTION_TIMEOUT_MS = Number(process.env.PIPELINE_3D_TIMEOUT_MS || 300000);

function getIngestionTimeout(fileSize?: number): number {
  if (!fileSize || fileSize <= 0) return INGESTION_TIMEOUT_MS;
  const dynamic = Math.min(15 * 60 * 1000, Math.max(INGESTION_TIMEOUT_MS, Math.ceil(fileSize / (1024 * 1024)) * 75000));
  return dynamic;
}

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

function parseJsonFromMixedOutput(output: string): any {
  const trimmed = output.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const candidate = trimmed.slice(start, end + 1);
      return JSON.parse(candidate);
    }
    throw new Error('Python returned non-JSON output');
  }
}

function toErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return String(err);
  const maybe = err as { message?: string; stdout?: string; stderr?: string; code?: string };
  const parts = [maybe.message, maybe.stderr, maybe.stdout].filter(Boolean) as string[];
  const joined = parts.join(' | ').trim();
  return joined || 'Unknown pipeline error';
}

function canExecutePython(command: string, useVersionFlag = false): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const args = useVersionFlag ? ['--version'] : ['-c', 'import sys; print(sys.version)'];
    const proc = execFileSync;
    try {
      proc(command, args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

async function resolvePythonExecutable(): Promise<string | null> {
  const isWindows = os.platform() === 'win32';
  const cwd = process.cwd();
  const candidates = isWindows
    ? [
      join(cwd, '.venv', 'Scripts', 'python.exe'),
      join(cwd, 'app', '.venv', 'Scripts', 'python.exe'),
      'python',
      'py',
    ]
    : [
      join(cwd, '.venv', 'bin', 'python'),
      join(cwd, '.venv', 'bin', 'python3'),
      '/app/.venv/bin/python',
      '/app/.venv/bin/python3',
      'python3',
      'python',
    ];

  for (const candidate of candidates) {
    if (candidate.includes('/') || candidate.includes('\\')) {
      if (!existsSync(candidate)) continue;
      if (await canExecutePython(candidate, true)) return candidate;
      continue;
    }
    if (await canExecutePython(candidate)) return candidate;
  }
  return null;
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

      const pythonExe = await resolvePythonExecutable();
      if (!pythonExe) {
        throw new Error('No usable Python interpreter found for blueprint pipeline');
      }

      const ingestionTimeout = getIngestionTimeout(fileSize);
      console.log(`[Pipeline] Running ingestion with timeout ${ingestionTimeout}ms for file size ${fileSize ?? 'unknown'}`);
      let blueprintData = null;
      try {
        const output = execFileSync(pythonExe, [pyScript, localPath], {
          encoding: 'utf-8',
          maxBuffer: 100 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: ingestionTimeout,
        });
        blueprintData = parseJsonFromMixedOutput(output);
      } catch (err: any) {
        const stdoutLog = typeof err?.stdout === 'string' ? err.stdout.trim().slice(0, 20000) : '';
        const stderrLog = typeof err?.stderr === 'string' ? err.stderr.trim().slice(0, 20000) : '';
        const detail = err?.code === 'ETIMEDOUT'
          ? `Timeout (${Math.round(ingestionTimeout / 1000)}s) - file too complex or too large`
          : toErrorMessage(err);
        console.error('[Pipeline] ingestion error', {
          detail,
          code: err?.code,
          stdout: stdoutLog,
          stderr: stderrLog,
        });
        throw new Error(`PIPELINE_STAGE_INGESTION_FAILED: ${detail}${stderrLog ? ` | stderr: ${stderrLog}` : ''}${stdoutLog ? ` | stdout: ${stdoutLog}` : ''}`);
      }

      if (!blueprintData || blueprintData.status !== 'success' || !blueprintData.data) {
        throw new Error('PIPELINE_STAGE_INGESTION_FAILED: ingestion did not return success payload');
      }

      let geometryData: any = null;
      let model3DData: any = null;
      const geomScript = join(process.cwd(), 'scripts', 'extract_geometry.py');
      try {
        // Only pass straight-line (Hough) paths to geometry — not polygon contours.
        // Contour paths are massive, noisy, and represent image textures/details, not walls.
        // The real structural data is in `lines` (PDF vector lines) + `scanned_line` paths.
        const MAX_GEOM_PATHS = 3000;
        const filteredPaths = (blueprintData.data.paths as any[] || [])
          .filter((p: any) => p.type === 'scanned_line')
          .slice(0, MAX_GEOM_PATHS);

        const geomOutput = execFileSync(pythonExe, [geomScript], {
          input: JSON.stringify({
            lines: blueprintData.data.lines || [],
            paths: filteredPaths,
            text: blueprintData.data.text || [],
            dimensions: blueprintData.data.dimensions || [],
            notes: blueprintData.data.notes || [],
            annotations: blueprintData.data.annotations || [],
            companyId: id,
            manualScale: item.manualScale || undefined,
            settings: {
              ...(item.settings || {}),
              enableSemanticClassification: item.settings?.enableSemanticClassification ?? false,
            },
          }),
          encoding: 'utf-8',
          maxBuffer: 100 * 1024 * 1024,
          timeout: GEOMETRY_TIMEOUT_MS,
        });
        geometryData = parseJsonFromMixedOutput(geomOutput);
      } catch (err: any) {
        const detail = err?.code === 'ETIMEDOUT' ? `Timeout (${Math.round(GEOMETRY_TIMEOUT_MS / 1000)}s)` : toErrorMessage(err);
        throw new Error(`PIPELINE_STAGE_GEOMETRY_FAILED: ${detail}`);
      }

      if (!geometryData || geometryData.error || !Array.isArray(geometryData.walls) || !Array.isArray(geometryData.rooms)) {
        throw new Error(`PIPELINE_STAGE_GEOMETRY_FAILED: invalid geometry payload (${JSON.stringify(geometryData?.error || geometryData)})`);
      }

      // Generate 3D Reconstruction
      const model3DScript = join(process.cwd(), 'scripts', 'generate_3d.py');
      try {
        const model3DOutput = execFileSync(pythonExe, [model3DScript], {
          input: JSON.stringify({
            walls: geometryData.walls || [],
            rooms: geometryData.rooms || [],
            notes: blueprintData.data.notes || [],
            text: blueprintData.data.text || [],
            settings: {
              ...(item.settings || {}),
              ...geometryData.settingsUsed,
            },
          }),
          env: { ...process.env },
          encoding: 'utf-8',
          maxBuffer: 50 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: RECONSTRUCTION_TIMEOUT_MS,
        });

        model3DData = parseJsonFromMixedOutput(model3DOutput);
      } catch (err: any) {
        const detail = err?.code === 'ETIMEDOUT' ? 'Timeout (180s)' : toErrorMessage(err);
        throw new Error(`PIPELINE_STAGE_3D_FAILED: ${detail}`);
      }

      if (!model3DData || model3DData.error || model3DData.status !== 'success' || !model3DData.takeoff) {
        throw new Error(`PIPELINE_STAGE_3D_FAILED: invalid reconstruction payload (${JSON.stringify(model3DData?.error || model3DData)})`);
      }

      if (isTemp) {
        try { await unlink(localPath); } catch (e) { }
      }

      // Store derived model content directly in the database
      // (Render uses an ephemeral filesystem — files in public/uploads are lost on deploy)
      const hasObj = !!(model3DData && model3DData.status === 'success' && model3DData.obj);
      const hasStep = !!(model3DData && model3DData.status === 'success' && model3DData.step);
      const hasUsd = !!(model3DData && model3DData.status === 'success' && model3DData.usd);

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
              blueprintData: {
                create: {
                  lines: JSON.stringify(blueprintData.data.lines || []),
                  paths: JSON.stringify(blueprintData.data.paths || []),
                  text: JSON.stringify(blueprintData.data.text || []),
                  dimensions: JSON.stringify(blueprintData.data.dimensions || []),
                  notes: JSON.stringify(blueprintData.data.notes || []),
                  annotations: JSON.stringify(blueprintData.data.annotations || []),
                },
              },
              geometryData: {
                create: {
                  walls: JSON.stringify(geometryData.walls || []),
                  rooms: JSON.stringify(geometryData.rooms || []),
                  openings: JSON.stringify(geometryData.openings || []),
                  zones: JSON.stringify(geometryData.zones || []),
                },
              },
              blueprint3DModel: (hasObj || hasStep || hasUsd) ? {
                create: {
                  objUrl: hasObj ? 'pending' : null,
                  stepUrl: hasStep ? 'pending' : null,
                  usdUrl: hasUsd ? 'pending' : null,
                  objData: hasObj ? model3DData.obj : null,
                  stepData: hasStep ? model3DData.step : null,
                  usdData: hasUsd ? model3DData.usd : null,
                }
              } : undefined,
              takeoffResult: {
                create: {
                  wallSurfaceArea: model3DData.takeoff.wallSurfaceArea,
                  floorCeilingArea: model3DData.takeoff.floorCeilingArea,
                  volume: model3DData.takeoff.volume,
                  drywallPanels: model3DData.takeoff.drywallPanels,
                  studs: model3DData.takeoff.studs,
                  paintGallons: model3DData.takeoff.paintGallons,
                  wasteFactor: model3DData.takeoff.wasteFactor,
                  insulationData: model3DData.takeoff.insulation ? JSON.stringify(model3DData.takeoff.insulation) : null,
                },
              },
            }
          }
        },
        include: { 
          versions: { 
            include: { 
              blueprintData: true, 
              geometryData: true, 
              blueprint3DModel: true, 
              takeoffResult: true 
            } 
          } 
        }
      });

      // Update the 3D model URLs to point to the API serving route
      const created3DModel = blueprintSet.versions[0]?.blueprint3DModel;
      if (created3DModel) {
        await prisma.blueprint3DModel.update({
          where: { id: created3DModel.id },
          data: {
            objUrl: hasObj ? `/api/models/${created3DModel.id}/obj` : null,
            stepUrl: hasStep ? `/api/models/${created3DModel.id}/step` : null,
            usdUrl: hasUsd ? `/api/models/${created3DModel.id}/usd` : null,
          },
        });
        // Refresh the blueprint set data so the response includes correct URLs
        blueprintSet.versions[0].blueprint3DModel!.objUrl = hasObj ? `/api/models/${created3DModel.id}/obj` : null;
        blueprintSet.versions[0].blueprint3DModel!.stepUrl = hasStep ? `/api/models/${created3DModel.id}/step` : null;
        blueprintSet.versions[0].blueprint3DModel!.usdUrl = hasUsd ? `/api/models/${created3DModel.id}/usd` : null;
      }
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

      if (hasObj && created3DModel) {
        const validation = validateObjContent(model3DData?.obj || '');
        const objContent = model3DData?.obj || '';
        await prisma.exportArtifact.create({
          data: {
            jobId: job.id,
            blueprintVersionId: createdVersion.id,
            artifactType: 'obj',
            filePath: `/api/models/${created3DModel.id}/obj`,
            fileSizeBytes: Buffer.byteLength(objContent, 'utf-8'),
            sha256Hash: createHash('sha256').update(objContent).digest('hex'),
            isValid: validation.isValid,
            validationError: validation.error,
          },
        });
      }
      if (hasStep && created3DModel) {
        const stepContent = model3DData?.step || '';
        const isValidStep = stepContent.includes('ISO-10303');
        const validation = { isValid: isValidStep, error: isValidStep ? null : 'STEP header missing ISO-10303 signature' };
        await prisma.exportArtifact.create({
          data: {
            jobId: job.id,
            blueprintVersionId: createdVersion.id,
            artifactType: 'step',
            filePath: `/api/models/${created3DModel.id}/step`,
            fileSizeBytes: Buffer.byteLength(stepContent, 'utf-8'),
            sha256Hash: createHash('sha256').update(stepContent).digest('hex'),
            isValid: validation.isValid,
            validationError: validation.error,
          },
        });
      }
      if (hasUsd && created3DModel) {
        const validation = validateUsdContent(model3DData?.usd || '');
        const usdContent = model3DData?.usd || '';
        await prisma.exportArtifact.create({
          data: {
            jobId: job.id,
            blueprintVersionId: createdVersion.id,
            artifactType: 'usd',
            filePath: `/api/models/${created3DModel.id}/usd`,
            fileSizeBytes: Buffer.byteLength(usdContent, 'utf-8'),
            sha256Hash: createHash('sha256').update(usdContent).digest('hex'),
            isValid: validation.isValid,
            validationError: validation.error,
          },
        });
      }

      createdSets.push({ ...blueprintSet, jobId: job.id });
    }

    return NextResponse.json({ blueprintSets: createdSets }, { status: 201 });
  } catch (err: any) {
    console.error("Blueprint upload error", err.message, err.stack);
    return NextResponse.json({ error: err.message || 'Server error', details: err.stack }, { status: 500 });
  }
}
