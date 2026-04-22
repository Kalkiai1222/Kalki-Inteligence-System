import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  
  const invite = await prisma.companyInvite.findUnique({
    where: { token },
    include: { company: true }
  });

  if (!invite) return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
  
  return NextResponse.json({ invite });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const invite = await prisma.companyInvite.findUnique({
    where: { token },
    include: { company: true }
  });

  if (!invite) return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
  
  const u = Object(auth).user;
  if (invite.email.toLowerCase() !== u.email.toLowerCase()) {
    return NextResponse.json({ error: 'This invite was sent to a different email address' }, { status: 403 });
  }

  const userId = Object(auth).userId;

  // Add member
  await prisma.$transaction([
    prisma.companyMember.upsert({
      where: { companyId_userId: { companyId: invite.companyId, userId: userId } },
      update: { role: invite.role },
      create: { companyId: invite.companyId, userId: userId, role: invite.role }
    }),
    prisma.companyInvite.delete({ where: { id: invite.id } })
  ]);

  return NextResponse.json({ success: true, companyId: invite.companyId });
}