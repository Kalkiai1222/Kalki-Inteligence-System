import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string, projectId: string, setId: string }> }) {
  const { id, projectId, setId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: Object(auth).userId } }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const blueprintSet = await prisma.blueprintSet.findFirst({
    where: { id: setId, projectId },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }
  });

  if (!blueprintSet) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const { fileUrl, notes } = await req.json();
    if (!fileUrl) return NextResponse.json({ error: 'File URL is required' }, { status: 400 });

    const newVersionNumber = blueprintSet.versions.length > 0 ? blueprintSet.versions[0].versionNumber + 1 : 1;

    const version = await prisma.blueprintVersion.create({
      data: {
        blueprintSetId: setId,
        versionNumber: newVersionNumber,
        fileUrl,
        notes
      }
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
