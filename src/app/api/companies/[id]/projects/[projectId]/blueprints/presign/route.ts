import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { generateUploadUrl } from '@/lib/storage';

export async function POST(req: Request, { params }: { params: Promise<{ id: string, projectId: string }> }) {
  const { id, projectId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: Object(auth).userId } }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { fileName, mimeType, fileHash, fileSize } = await req.json();
    if (!fileName || !mimeType || !fileHash || !fileSize) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    // Duplicate detection based on hash physically stored
    const existing = await prisma.blueprintVersion.findFirst({
      where: { fileHash },
      include: { blueprintSet: true }
    });

    if (existing) {
      // If identical file was already loaded somewhere in exactly this project
      if (existing.blueprintSet.projectId === projectId) {
         return NextResponse.json({ duplicate: true, fileUrl: existing.fileUrl, fileKey: existing.fileKey, message: 'Already secured in this project' }, { status: 200 });
      }
    }

    const { uploadUrl, fileUrl, fileKey, method } = await generateUploadUrl(fileName, mimeType, projectId);

    return NextResponse.json({ uploadUrl, fileUrl, fileKey, method }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Storage allocation failed' }, { status: 500 });
  }
}
