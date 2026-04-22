import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const fromWall = url.searchParams.get('from_wall');
  if (!fromWall) return NextResponse.json({ error: 'from_wall is required' }, { status: 400 });

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { project: true, blueprintVersion: true },
  });
  if (!job || !job.blueprintVersion || !job.blueprintVersionId) {
    return NextResponse.json({ error: 'Job/version not found' }, { status: 404 });
  }

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: job.project.companyId, userId: auth.userId as string } },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const latestVersion = await prisma.blueprintVersion.findFirst({
    where: { blueprintSetId: job.blueprintVersion.blueprintSetId },
    orderBy: { versionNumber: 'desc' },
  });
  const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

  const newVersion = await prisma.blueprintVersion.create({
    data: {
      blueprintSetId: job.blueprintVersion.blueprintSetId,
      versionNumber: nextVersionNumber,
      fileUrl: job.blueprintVersion.fileUrl,
      fileKey: job.blueprintVersion.fileKey,
      fileSize: job.blueprintVersion.fileSize,
      mimeType: job.blueprintVersion.mimeType,
      fileHash: job.blueprintVersion.fileHash,
      notes: `Rerun from wall ${fromWall} (job ${jobId})`,
    },
  });

  await prisma.jobStatusEvent.create({
    data: { jobId: job.id, status: 'processing' },
  });
  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'processing', blueprintVersionId: newVersion.id },
  });

  return NextResponse.json({ versionId: newVersion.id, status: 'processing' }, { status: 201 });
}
