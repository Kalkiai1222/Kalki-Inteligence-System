import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { sendEmail, generateInviteHTML } from '@/lib/email';
import crypto from 'crypto';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const p = await req.json();
    const { email, role } = p;
    
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: id, userId: Object(auth).userId } },
      include: { company: true }
    });

    if (!membership || membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can invite' }, { status: 403 });
    }

    // check if user already an active member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId: id, userId: existingUser.id } }
      });
      if (existingMember) return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    // Upsert to handle re-invites
    const invite = await prisma.companyInvite.upsert({
      where: { companyId_email: { companyId: id, email } },
      update: { token, expiresAt, role: role || 'MEMBER' },
      create: { companyId: id, email, role: role || 'MEMBER', token, expiresAt }
    });

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${token}`;
    await sendEmail(email, `Invitation to join ${membership.company.name}`, generateInviteHTML(membership.company.name, inviteLink));

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}