import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string, projectId: string, versionId: string }> }) {
  const { id, projectId, versionId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: Object(auth).userId } }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const version = await prisma.blueprintVersion.findUnique({
      where: { id: versionId },
      include: {
        blueprintSet: {
          include: {
            project: true
          }
        },
        blueprintData: true,
        geometryData: true,
        blueprint3DModel: true,
        takeoffResult: true
      }
    });

    if (!version) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (version.blueprintSet.projectId !== projectId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    return NextResponse.json({ version });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}