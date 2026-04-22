import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { z } from 'zod';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const correctionSchema = z.object({
  projectId: z.string(),
  versionId: z.string(),
  wallId: z.string(),
  original_reasoning: z.string(),
  corrected_reasoning: z.string(),
  correction_type: z.enum(['classification', 'material', 'dimension', 'other']),
});

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; projectId: string; versionId: string }>;
  }
) {
  try {
    const { id: companyId, projectId, versionId } = await params;
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: auth.userId as string } },
    });
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const blueprintVersion = await prisma.blueprintVersion.findUnique({
      where: { id: versionId },
      include: {
        blueprintSet: {
          include: {
            project: {
              select: { companyId: true },
            },
          },
        },
      },
    });

    if (!blueprintVersion || blueprintVersion.blueprintSet.project.companyId !== companyId || blueprintVersion.blueprintSet.projectId !== projectId) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const wallId = searchParams.get('wall_id');

    if (wallId) {
      const wallTrace = await prisma.reasoningTrace.findUnique({
        where: {
          projectId_blueprintVersionId_wallId: {
            projectId,
            blueprintVersionId: versionId,
            wallId,
          },
        },
      });
      if (!wallTrace) return NextResponse.json({ error: `ReasoningNotFoundError: ${projectId}/${versionId}/${wallId}` }, { status: 404 });
      return NextResponse.json({ status: 'success', wall_trace: wallTrace, schema_version: 'v1' });
    }

    const traces = await prisma.reasoningTrace.findMany({
      where: { projectId, blueprintVersionId: versionId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      status: 'success',
      reasoning: traces,
      schema_version: 'v1',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to fetch reasoning data',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Store reasoning validation/corrections
 * 
 * Used when user corrects a reasoning decision
 * Example: User says "This wall should be classified as exterior, not interior"
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; projectId: string; versionId: string }>;
  }
) {
  try {
    const { id: companyId, projectId, versionId } = await params;
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: auth.userId as string } },
    });
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const parsed = correctionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const body = parsed.data;
    const storageKey = `corrections/${projectId}/${versionId}/${body.wallId}.json`;
    const outPath = join(process.cwd(), 'public', storageKey);
    await mkdir(join(process.cwd(), 'public', 'corrections', projectId, versionId), { recursive: true });
    await writeFile(
      outPath,
      JSON.stringify({ ...body, corrected_by: auth.userId as string, created_at: new Date().toISOString() }, null, 2),
      'utf-8'
    );

    const correction = await prisma.reasoningCorrection.create({
      data: {
        companyId,
        projectId,
        blueprintVersionId: versionId,
        wallId: body.wallId,
        originalReasoning: body.original_reasoning,
        correctedReasoning: body.corrected_reasoning,
        correctionType: body.correction_type,
        correctedBy: auth.userId as string,
        storageKey,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.userId as string,
        companyId,
        action: 'CREATE',
        resourceType: 'ReasoningCorrection',
        resourceId: correction.id,
        changes: JSON.stringify(body),
        status: 'SUCCESS',
      },
    });

    return NextResponse.json({ status: 'success', correction, schema_version: 'v1' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to store correction',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
