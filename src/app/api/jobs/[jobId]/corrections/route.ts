import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { execFileSync } from 'child_process';

const correctionSchema = z.object({
  projectId: z.string().min(1),
  versionId: z.string().min(1),
  wallId: z.string().min(1),
  original_reasoning: z.string().min(1),
  corrected_reasoning: z.string().min(1),
  correction_type: z.enum(['classification', 'material', 'dimension', 'other']),
});

import { existsSync } from 'fs';

function getPythonExe(): string {
  const pythonExe = process.platform === 'win32'
    ? join(process.cwd(), '.venv', 'Scripts', 'python.exe')
    : join(process.cwd(), '.venv', 'bin', 'python');
    
  if (!existsSync(pythonExe)) {
    return 'python3';
  }
  return pythonExe;
}

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = correctionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { project: true } });
  if (!job || !job.blueprintVersionId) return NextResponse.json({ error: 'Job/version not found' }, { status: 404 });

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: job.project.companyId, userId: auth.userId as string } },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { projectId, versionId, wallId, original_reasoning, corrected_reasoning, correction_type } = parsed.data;
  const storageKey = `corrections/${projectId}/${versionId}/${wallId}.json`;
  const targetPath = join(process.cwd(), 'public', storageKey);
  await mkdir(join(process.cwd(), 'public', 'corrections', projectId, versionId), { recursive: true });

  const record = {
    projectId,
    versionId,
    wallId,
    original_reasoning,
    corrected_reasoning,
    correction_type,
    corrected_by: auth.userId as string,
    created_at: new Date().toISOString(),
  };
  await writeFile(targetPath, JSON.stringify(record, null, 2), 'utf-8');

  const correction = await prisma.reasoningCorrection.create({
    data: {
      companyId: job.project.companyId,
      projectId,
      blueprintVersionId: versionId,
      wallId,
      originalReasoning: original_reasoning,
      correctedReasoning: corrected_reasoning,
      correctionType: correction_type,
      correctedBy: auth.userId as string,
      storageKey,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: auth.userId as string,
      companyId: job.project.companyId,
      action: 'CREATE',
      resourceType: 'ReasoningCorrection',
      resourceId: correction.id,
      changes: JSON.stringify(record),
      status: 'SUCCESS',
    },
  });

  try {
    const scriptPath = join(process.cwd(), 'scripts', 'elastic_memory.py');
    const payload = JSON.stringify({
      companyId: job.project.companyId,
      text: corrected_reasoning,
      embeddingId: correction.createdAt.getTime(),
    });
    execFileSync(getPythonExe(), [scriptPath, 'add'], { input: payload, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  } catch {
    // Database correction is persisted even if embedding sync fails.
  }

  return NextResponse.json({ correction }, { status: 201 });
}
