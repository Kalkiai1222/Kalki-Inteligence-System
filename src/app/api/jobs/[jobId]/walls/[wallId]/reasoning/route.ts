import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ jobId: string; wallId: string }> }
) {
  const { jobId, wallId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { project: true },
  });
  if (!job || !job.blueprintVersionId) {
    return NextResponse.json({ error: 'Job or version not found' }, { status: 404 });
  }

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: job.project.companyId, userId: auth.userId as string } },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const trace = await prisma.reasoningTrace.findUnique({
    where: {
      projectId_blueprintVersionId_wallId: {
        projectId: job.projectId,
        blueprintVersionId: job.blueprintVersionId,
        wallId,
      },
    },
  });
  if (!trace) return NextResponse.json({ error: 'Reasoning not found' }, { status: 404 });

  const corrections = await prisma.reasoningCorrection.findMany({
    where: {
      projectId: job.projectId,
      blueprintVersionId: job.blueprintVersionId,
      wallId,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return NextResponse.json({
    reasoning: trace,
    corrections,
  });
}
