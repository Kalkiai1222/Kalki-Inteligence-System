import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string, memberId: string }> }) {
  const { id, memberId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userId = Object(auth).userId;

  const requester = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: userId } }
  });

  if (!requester || requester.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can remove members' }, { status: 403 });
  }

  if (userId === memberId) {
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
  }

  const member = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: memberId } }
  });

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  await prisma.companyMember.delete({
    where: { id: member.id }
  });

  return NextResponse.json({ success: true });
}