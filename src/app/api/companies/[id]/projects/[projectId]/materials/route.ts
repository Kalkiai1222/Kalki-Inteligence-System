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

  const materials = await prisma.material.findMany({
    where: { projectId },
    include: { job: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ materials });
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
  const { name, quantity, unit, cost, status, jobId } = body;

  const material = await prisma.material.create({
    data: {
      projectId,
      jobId: jobId || null,
      name,
      quantity: parseFloat(quantity),
      unit,
      cost: cost ? parseFloat(cost) : null,
      status: status || 'REQUESTED'
    }
  });

  return NextResponse.json({ material });
}