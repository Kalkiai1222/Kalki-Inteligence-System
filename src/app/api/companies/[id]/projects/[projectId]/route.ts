import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string, projectId: string }> }) {
  try {
    const { id, projectId } = await params;
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: id, userId: Object(auth).userId } }
    });
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: id },
      include: {
        client: true,
        blueprintSets: { include: { versions: { orderBy: { versionNumber: 'desc' } } }, orderBy: { createdAt: 'desc' } }
      }
    });

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    return NextResponse.json({ project });
  } catch (err: any) {
    console.error('GET /projects/{projectId} error:', err.message);
    return NextResponse.json({ error: 'Failed to fetch project', details: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string, projectId: string }> }) {
  try {
    const { id, projectId } = await params;
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: id, userId: Object(auth).userId } }
    });
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId: id } });
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { name, description, clientId, status } = await req.json();

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        name,
        description,
        clientId: clientId || null,
        status
      },
      include: { client: true }
    });

    return NextResponse.json({ project: updated });
  } catch (err: any) {
    console.error('PUT /projects/{projectId} error:', err.message);
    return NextResponse.json({ error: 'Failed to update project', details: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string, projectId: string }> }) {
  try {
    const { id, projectId } = await params;
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: id, userId: Object(auth).userId } }
    });
    if (!membership || membership.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId: id } });
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.project.delete({ where: { id: projectId } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /projects/{projectId} error:', err.message);
    return NextResponse.json({ error: 'Failed to delete project', details: err.message }, { status: 500 });
  }
}
