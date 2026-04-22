import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: Object(auth).userId } }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const projects = await prisma.project.findMany({
    where: { companyId: id },
    include: { client: true, _count: { select: { blueprintSets: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ projects });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: Object(auth).userId } }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { name, description, clientId, status } = await req.json();
    if (!name) return NextResponse.json({ error: 'Project name is required' }, { status: 400 });

    const project = await prisma.project.create({
      data: {
        companyId: id,
        name,
        description,
        clientId: clientId || null,
        status: status || 'PLANNING'
      },
      include: { client: true }
    });

    await createAuditLog({
      userId: auth.userId as string,
      companyId: id,
      action: 'CREATE_PROJECT',
      resourceType: 'Project',
      resourceId: project.id,
      changes: { name, description, status },
    });

    const members = await prisma.companyMember.findMany({
      where: { companyId: id },
    });

    for (const member of members) {
      if (member.userId !== auth.userId) {
        await createNotification({
          userId: member.userId,
          companyId: id,
          title: 'New Project Created',
          message: `A new project "${name}" was created.`,
          type: 'SUCCESS',
          link: `/dashboard/companies/${id}/projects/${project.id}`,
        });
      }
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
