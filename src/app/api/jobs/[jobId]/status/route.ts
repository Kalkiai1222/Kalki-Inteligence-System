import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      project: true,
      statusEvents: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: job.project.companyId, userId: auth.userId as string } },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({
    jobId,
    status: job.status,
    requiresReview: job.requiresReview,
    meshQuality: job.meshQuality,
    startedAt: job.startDate,
    endedAt: job.endDate,
    transitions: job.statusEvents.map((e) => ({ status: e.status, createdAt: e.createdAt })),
  });
}
