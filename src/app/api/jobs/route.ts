import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const { projectId, name, description, blueprintVersionId } = body;
  if (!projectId || !name) return NextResponse.json({ error: 'projectId and name are required' }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: project.companyId, userId: auth.userId as string } },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const existing = await prisma.job.findFirst({
    where: { id: body.idempotencyKey || '', status: 'completed' },
  });
  if (existing) return NextResponse.json({ job: existing, reused: true });

  const job = await prisma.job.create({
    data: {
      projectId,
      blueprintVersionId: blueprintVersionId ?? null,
      name,
      description,
      status: 'uploaded',
      startDate: new Date(),
    },
  });
  await prisma.jobStatusEvent.create({ data: { jobId: job.id, status: 'uploaded' } });

  return NextResponse.json({ job }, { status: 201 });
}
