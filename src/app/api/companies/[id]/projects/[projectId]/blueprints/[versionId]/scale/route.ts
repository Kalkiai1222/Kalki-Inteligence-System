import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';

type RouteParams = Promise<{ id: string; projectId: string; versionId: string }>;

type ScaleResult = {
  scale: number;
  method: 'manual' | 'text' | 'dimension' | 'door_width' | 'fallback';
  confidence: number;
  detected_text: string | null;
  unit_system: 'imperial' | 'metric' | 'unknown';
  notes: string;
};

function parseJsonString<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function verifyAccess(companyId: string, projectId: string, versionId: string, userId: string) {
  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  if (!membership) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

  const version = await prisma.blueprintVersion.findUnique({
    where: { id: versionId },
    include: {
      blueprintSet: {
        include: {
          project: true,
        },
      },
      blueprintData: true,
      geometryData: true,
      takeoffResult: true,
    },
  });

  if (!version) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (version.blueprintSet.projectId !== projectId || version.blueprintSet.project.companyId !== companyId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) };
  }

  return { version };
}
function getPythonExe(): string {
  const pythonExe = process.platform === 'win32'
    ? join(process.cwd(), '.venv', 'Scripts', 'python.exe')
    : join(process.cwd(), '.venv', 'bin', 'python');

  if (!existsSync(pythonExe)) {
    console.warn(`Venv python not found at ${pythonExe}, attempting global 'python3' fallback`);
    return 'python3';
  }
  return pythonExe;
}

async function readManualScaleOverride(projectId: string, versionId: string): Promise<number | null> {
  const overridePath = join(process.cwd(), 'public', 'uploads', 'projects', projectId, `${versionId}-scale-override.json`);
  if (!existsSync(overridePath)) return null;

  try {
    const raw = await readFile(overridePath, 'utf-8');
    const parsed = JSON.parse(raw) as { scale?: number };
    if (typeof parsed.scale === 'number' && parsed.scale > 0) return parsed.scale;
    return null;
  } catch {
    return null;
  }
}

async function writeManualScaleOverride(projectId: string, versionId: string, scale: number, notes?: string) {
  const dir = join(process.cwd(), 'public', 'uploads', 'projects', projectId);
  await mkdir(dir, { recursive: true });

  const overridePath = join(dir, `${versionId}-scale-override.json`);
  await writeFile(
    overridePath,
    JSON.stringify(
      {
        scale,
        notes: notes || null,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf-8'
  );
}

function detectScale(payload: {
  manualScale?: number | null;
  text: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
  dimensions: Array<Record<string, unknown>>;
  segments: Array<unknown>;
}): ScaleResult {
  const pythonExe = getPythonExe();
  const code = [
    'import json,sys',
    'from scale.scale_detection import get_scale_multiplier',
    'payload = json.loads(sys.stdin.read())',
    'multiplier, unit_system, detected_text = get_scale_multiplier(payload)',
    'method = "fallback"',
    'if unit_system == "manual": method = "manual"',
    'elif unit_system == "estimated": method = "door_width"',
    'elif unit_system in ("imperial", "metric"): method = "text"',
    'confidence = 0.5',
    'if method == "manual": confidence = 1.0',
    'elif method == "text": confidence = 0.9',
    'elif method == "door_width": confidence = 0.7',
    'result = {',
    '  "scale": float(multiplier),',
    '  "method": method,',
    '  "confidence": confidence,',
    '  "detected_text": detected_text,',
    '  "unit_system": unit_system if unit_system in ("imperial","metric","unknown") else "unknown",',
    '  "notes": f"Detected via {method}"',
    '}',
    'print(json.dumps(result))',
  ].join('; ');

  const output = execFileSync(pythonExe, ['-c', code], {
    encoding: 'utf-8',
    input: JSON.stringify(payload),
    env: {
      ...process.env,
      PYTHONPATH: join(process.cwd(), 'scripts'),
    },
    maxBuffer: 10 * 1024 * 1024,
  });

  return JSON.parse(output) as ScaleResult;
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export async function GET(req: Request, { params }: { params: RouteParams }) {
  const { id, projectId, versionId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const access = await verifyAccess(id, projectId, versionId, Object(auth).userId);
  if ('error' in access) return access.error;

  try {
    const version = access.version;
    const text = parseJsonString<Array<Record<string, unknown>>>(version.blueprintData?.text, []);
    const notes = parseJsonString<Array<Record<string, unknown>>>(version.blueprintData?.notes, []);
    const dimensions = parseJsonString<Array<Record<string, unknown>>>(version.blueprintData?.dimensions, []);
    const lines = parseJsonString<Array<unknown>>(version.blueprintData?.lines, []);

    const manualScale = await readManualScaleOverride(projectId, versionId);

    const result = detectScale({
      manualScale,
      text,
      notes,
      dimensions,
      segments: lines,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Scale detection GET failed', err);
    return NextResponse.json({ error: err.message || 'Scale detection failed' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: RouteParams }) {
  const { id, projectId, versionId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const access = await verifyAccess(id, projectId, versionId, Object(auth).userId);
  if ('error' in access) return access.error;

  try {
    const body = (await req.json()) as { scale?: number; notes?: string };
    const manualScale = Number(body.scale);

    if (!Number.isFinite(manualScale) || manualScale <= 0) {
      return NextResponse.json({ error: 'Scale must be a positive number' }, { status: 400 });
    }

    const version = access.version;
    const blueprintData = {
      lines: parseJsonString<Array<unknown>>(version.blueprintData?.lines, []),
      paths: parseJsonString<Array<unknown>>(version.blueprintData?.paths, []),
      text: parseJsonString<Array<Record<string, unknown>>>(version.blueprintData?.text, []),
      dimensions: parseJsonString<Array<Record<string, unknown>>>(version.blueprintData?.dimensions, []),
      notes: parseJsonString<Array<Record<string, unknown>>>(version.blueprintData?.notes, []),
      annotations: parseJsonString<Array<Record<string, unknown>>>(version.blueprintData?.annotations, []),
    };

    await writeManualScaleOverride(projectId, versionId, manualScale, body.notes);

    const pythonExe = getPythonExe();
    const geomScript = join(process.cwd(), 'scripts', 'extract_geometry.py');
    const model3DScript = join(process.cwd(), 'scripts', 'generate_3d.py');

    const geometryOutput = execFileSync(pythonExe, [geomScript], {
      encoding: 'utf-8',
      input: JSON.stringify({
        ...blueprintData,
        companyId: id,
        manualScale,
        settings: {},
      }),
      maxBuffer: 50 * 1024 * 1024,
    });
    const geometryData = JSON.parse(geometryOutput);

    const model3DOutput = execFileSync(pythonExe, [model3DScript], {
      encoding: 'utf-8',
      input: JSON.stringify({
        walls: geometryData.walls || [],
        rooms: geometryData.rooms || [],
        notes: blueprintData.notes || [],
        text: blueprintData.text || [],
        settings: geometryData.settingsUsed || {},
      }),
      env: { ...process.env },
      maxBuffer: 50 * 1024 * 1024,
    });
    const model3DData = JSON.parse(model3DOutput);

    if (model3DData?.status === 'quality_failed') {
      const failedJob = await prisma.job.findFirst({ where: { blueprintVersionId: versionId }, orderBy: { createdAt: 'desc' } });
      if (failedJob) {
        await prisma.job.update({
          where: { id: failedJob.id },
          data: { status: 'quality_failed', meshQuality: 'failed' },
        });
        await prisma.jobStatusEvent.create({ data: { jobId: failedJob.id, status: 'quality_failed' } });
        await prisma.deadLetterJob.upsert({
          where: { jobId: failedJob.id },
          update: {
            reason: 'Mesh quality failed',
            errorCode: 'E004',
            errorDetail: JSON.stringify(model3DData.quality_report || {}),
            retryCount: { increment: 1 },
          },
          create: {
            jobId: failedJob.id,
            reason: 'Mesh quality failed',
            errorCode: 'E004',
            errorDetail: JSON.stringify(model3DData.quality_report || {}),
            payload: JSON.stringify({ versionId }),
          },
        });
      }
      return NextResponse.json({ error: 'Mesh quality failed', report: model3DData.quality_report }, { status: 422 });
    }

    // Store derived model content directly in the database
    // (Render uses an ephemeral filesystem — files in public/uploads are lost on deploy)
    const hasObj = !!(model3DData?.status === 'success' && model3DData.obj);
    const hasStep = !!(model3DData?.status === 'success' && model3DData.step);
    const hasUsd = !!(model3DData?.status === 'success' && model3DData.usd);

    await prisma.blueprintGeometry.upsert({
      where: { blueprintVersionId: versionId },
      update: {
        walls: JSON.stringify(geometryData.walls || []),
        rooms: JSON.stringify(geometryData.rooms || []),
        openings: JSON.stringify(geometryData.openings || []),
        zones: JSON.stringify(geometryData.zones || []),
      },
      create: {
        blueprintVersionId: versionId,
        walls: JSON.stringify(geometryData.walls || []),
        rooms: JSON.stringify(geometryData.rooms || []),
        openings: JSON.stringify(geometryData.openings || []),
        zones: JSON.stringify(geometryData.zones || []),
      },
    });

    if (model3DData?.quality_report) {
      await prisma.meshQualityReport.upsert({
        where: { blueprintVersionId: versionId },
        update: {
          isWatertight: !!model3DData.quality_report.is_watertight,
          nonManifoldEdgeCount: Number(model3DData.quality_report.non_manifold_edge_count || 0),
          invertedNormalCount: Number(model3DData.quality_report.inverted_normal_count || 0),
          degenerateFaceCount: Number(model3DData.quality_report.degenerate_face_count || 0),
          passed: !!model3DData.quality_report.passed,
          failureReasons: JSON.stringify(model3DData.quality_report.failure_reasons || []),
        },
        create: {
          blueprintVersionId: versionId,
          isWatertight: !!model3DData.quality_report.is_watertight,
          nonManifoldEdgeCount: Number(model3DData.quality_report.non_manifold_edge_count || 0),
          invertedNormalCount: Number(model3DData.quality_report.inverted_normal_count || 0),
          degenerateFaceCount: Number(model3DData.quality_report.degenerate_face_count || 0),
          passed: !!model3DData.quality_report.passed,
          failureReasons: JSON.stringify(model3DData.quality_report.failure_reasons || []),
        },
      });
    }

    if (model3DData?.status === 'success' && model3DData?.takeoff) {
      await prisma.takeoffResult.upsert({
        where: { blueprintVersionId: versionId },
        update: {
          wallSurfaceArea: model3DData.takeoff.wallSurfaceArea,
          floorCeilingArea: model3DData.takeoff.floorCeilingArea,
          volume: model3DData.takeoff.volume,
          drywallPanels: model3DData.takeoff.drywallPanels,
          studs: model3DData.takeoff.studs,
          paintGallons: model3DData.takeoff.paintGallons,
          wasteFactor: model3DData.takeoff.wasteFactor,
          insulationData: model3DData.takeoff.insulation
            ? JSON.stringify(model3DData.takeoff.insulation)
            : null,
        },
        create: {
          blueprintVersionId: versionId,
          wallSurfaceArea: model3DData.takeoff.wallSurfaceArea,
          floorCeilingArea: model3DData.takeoff.floorCeilingArea,
          volume: model3DData.takeoff.volume,
          drywallPanels: model3DData.takeoff.drywallPanels,
          studs: model3DData.takeoff.studs,
          paintGallons: model3DData.takeoff.paintGallons,
          wasteFactor: model3DData.takeoff.wasteFactor,
          insulationData: model3DData.takeoff.insulation
            ? JSON.stringify(model3DData.takeoff.insulation)
            : null,
        },
      });
    }

    if (model3DData?.takeoff?.perWallDetails && Array.isArray(model3DData.takeoff.perWallDetails)) {
      await prisma.reasoningTrace.deleteMany({ where: { projectId, blueprintVersionId: versionId } });
      for (const detail of model3DData.takeoff.perWallDetails) {
        const wallId = `wall_${detail.wallIndex}`;
        await prisma.reasoningTrace.create({
          data: {
            companyId: id,
            projectId,
            blueprintVersionId: versionId,
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

    let created3DModel = null;
    if (hasObj || hasStep || hasUsd) {
      created3DModel = await prisma.blueprint3DModel.upsert({
        where: { blueprintVersionId: versionId },
        update: {
          objUrl: hasObj ? 'pending' : null,
          stepUrl: hasStep ? 'pending' : null,
          usdUrl: hasUsd ? 'pending' : null,
          objData: hasObj ? model3DData.obj : null,
          stepData: hasStep ? model3DData.step : null,
          usdData: hasUsd ? model3DData.usd : null,
        },
        create: {
          blueprintVersionId: versionId,
          objUrl: hasObj ? 'pending' : null,
          stepUrl: hasStep ? 'pending' : null,
          usdUrl: hasUsd ? 'pending' : null,
          objData: hasObj ? model3DData.obj : null,
          stepData: hasStep ? model3DData.step : null,
          usdData: hasUsd ? model3DData.usd : null,
        },
      });

      // Update URLs to use the API route
      await prisma.blueprint3DModel.update({
        where: { id: created3DModel.id },
        data: {
          objUrl: hasObj ? `/api/models/${created3DModel.id}/obj` : null,
          stepUrl: hasStep ? `/api/models/${created3DModel.id}/step` : null,
          usdUrl: hasUsd ? `/api/models/${created3DModel.id}/usd` : null,
        },
      });
    }

    const existingJob = await prisma.job.findFirst({
      where: { blueprintVersionId: versionId },
      orderBy: { createdAt: 'desc' },
    });
    if (existingJob) {
      await prisma.job.update({
        where: { id: existingJob.id },
        data: {
          status: model3DData?.quality_report?.passed === false ? 'quality_failed' : 'validated',
          meshQuality: model3DData?.mesh_quality ?? null,
          requiresReview: !!model3DData?.takeoff?.perWallDetails?.some((d: any) => typeof d.confidence === 'number' && d.confidence < 0.75),
          endDate: new Date(),
        },
      });
      await prisma.jobStatusEvent.createMany({
        data: [
          { jobId: existingJob.id, status: 'quality_check' },
          { jobId: existingJob.id, status: model3DData?.quality_report?.passed === false ? 'failed' : 'validated' },
        ],
      });

      if (hasObj && created3DModel) {
        const objContent = model3DData.obj;
        await prisma.exportArtifact.upsert({
          where: { id: `${existingJob.id}-obj` },
          update: {
            filePath: `/api/models/${created3DModel.id}/obj`,
            fileSizeBytes: Buffer.byteLength(objContent, 'utf-8'),
            sha256Hash: createHash('sha256').update(objContent).digest('hex'),
            isValid: true,
            validationError: null,
          },
          create: {
            id: `${existingJob.id}-obj`,
            jobId: existingJob.id,
            blueprintVersionId: versionId,
            artifactType: 'obj',
            filePath: `/api/models/${created3DModel.id}/obj`,
            fileSizeBytes: Buffer.byteLength(objContent, 'utf-8'),
            sha256Hash: createHash('sha256').update(objContent).digest('hex'),
            isValid: true,
          },
        });
      }
      if (hasStep && created3DModel) {
        const stepContent = model3DData.step;
        const isValidStep = stepContent.includes('ISO-10303');
        await prisma.exportArtifact.upsert({
          where: { id: `${existingJob.id}-step` },
          update: {
            filePath: `/api/models/${created3DModel.id}/step`,
            fileSizeBytes: Buffer.byteLength(stepContent, 'utf-8'),
            sha256Hash: createHash('sha256').update(stepContent).digest('hex'),
            isValid: isValidStep,
            validationError: isValidStep ? null : 'STEP header missing ISO-10303 signature',
          },
          create: {
            id: `${existingJob.id}-step`,
            jobId: existingJob.id,
            blueprintVersionId: versionId,
            artifactType: 'step',
            filePath: `/api/models/${created3DModel.id}/step`,
            fileSizeBytes: Buffer.byteLength(stepContent, 'utf-8'),
            sha256Hash: createHash('sha256').update(stepContent).digest('hex'),
            isValid: isValidStep,
            validationError: isValidStep ? null : 'STEP header missing ISO-10303 signature',
          },
        });
      }
      if (hasUsd && created3DModel) {
        const usdContent = model3DData.usd;
        const isValidUsd = usdContent.includes('#usda') || usdContent.includes('def Mesh');
        await prisma.exportArtifact.upsert({
          where: { id: `${existingJob.id}-usd` },
          update: {
            filePath: `/api/models/${created3DModel.id}/usd`,
            fileSizeBytes: Buffer.byteLength(usdContent, 'utf-8'),
            sha256Hash: createHash('sha256').update(usdContent).digest('hex'),
            isValid: isValidUsd,
            validationError: isValidUsd ? null : 'USD validation failed',
          },
          create: {
            id: `${existingJob.id}-usd`,
            jobId: existingJob.id,
            blueprintVersionId: versionId,
            artifactType: 'usd',
            filePath: `/api/models/${created3DModel.id}/usd`,
            fileSizeBytes: Buffer.byteLength(usdContent, 'utf-8'),
            sha256Hash: createHash('sha256').update(usdContent).digest('hex'),
            isValid: isValidUsd,
            validationError: isValidUsd ? null : 'USD validation failed',
          },
        });
      }
    }

    const scaleResult = detectScale({
      manualScale,
      text: blueprintData.text,
      notes: blueprintData.notes,
      dimensions: blueprintData.dimensions,
      segments: blueprintData.lines,
    });

    return NextResponse.json(scaleResult);
  } catch (err: any) {
    console.error('Scale override POST failed', err);
    return NextResponse.json({ error: err.message || 'Scale override failed' }, { status: 500 });
  }
}
