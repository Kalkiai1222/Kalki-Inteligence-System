import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

function toPublicUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/public';
  const idx = normalized.indexOf(marker);
  if (idx >= 0) return normalized.slice(idx + marker.length);
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      project: true,
      exportArtifacts: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: job.project.companyId, userId: auth.userId as string } },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({
    jobId,
    exports: job.exportArtifacts.map((artifact) => ({
      artifactType: artifact.artifactType,
      fileSizeBytes: artifact.fileSizeBytes,
      sha256Hash: artifact.sha256Hash,
      isValid: artifact.isValid,
      validationError: artifact.validationError,
      createdAt: artifact.createdAt,
      url: toPublicUrl(artifact.filePath),
    })),
  });
}
