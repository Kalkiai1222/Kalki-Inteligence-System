import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string, projectId: string }> }) {
  const { id, projectId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // verify permission
  const member = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: auth.userId as string } }
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const jobs = await prisma.job.findMany({
    where: { projectId },
    include: { materials: true },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string, projectId: string }> }) {
  const { id, projectId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const member = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: auth.userId as string } }
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, description, status, startDate, endDate, blueprintVersionId } = body;

  const normalizedStatus = status || 'uploaded';

  const job = await prisma.job.create({
    data: {
      projectId,
      blueprintVersionId: blueprintVersionId || null,
      name,
      description,
      status: normalizedStatus,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    }
  });

  await prisma.jobStatusEvent.create({
    data: { jobId: job.id, status: normalizedStatus },
  });

  return NextResponse.json({ job });
}