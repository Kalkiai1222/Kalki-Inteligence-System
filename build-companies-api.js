const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 1. Create auth helper
ensureDir('src/lib');
fs.writeFileSync('src/lib/require-auth.ts', \
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken, verifyRefreshToken, signAccessToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function requireAuth() {
  const reqCookies = await cookies();
  let accessToken = reqCookies.get('accessToken')?.value;
  const refreshToken = reqCookies.get('refreshToken')?.value;

  if (!accessToken && !refreshToken) {
    return { error: 'Unauthorized', status: 401 };
  }

  let payload = accessToken ? verifyAccessToken(accessToken) as { userId: string } | null : null;

  if (!payload && refreshToken) {
    const refreshPayload = verifyRefreshToken(refreshToken) as { userId: string } | null;
    
    if (!refreshPayload) return { error: 'Session expired', status: 401 };

    const session = await prisma.session.findUnique({
      where: { refreshToken },
    });

    if (!session || session.expiresAt < new Date()) {
      return { error: 'Invalid or expired session', status: 401 };
    }

    accessToken = signAccessToken({ userId: refreshPayload.userId });
    
    reqCookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60,
      path: '/',
    });
    
    payload = { userId: refreshPayload.userId };
  }

  if (!payload) return { error: 'Unauthorized', status: 401 };
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return { error: 'User not found', status: 404 };

  return { userId: payload.userId, user };
}
\);

// 2. Base Companies API
ensureDir('src/app/api/companies');
fs.writeFileSync('src/app/api/companies/route.ts', \
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const companies = await prisma.company.findMany({
    where: { members: { some: { userId: auth.userId } } },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { name } = await req.json();
    if (!name || name.length < 2) return NextResponse.json({ error: 'Company name is too short' }, { status: 400 });

    const company = await prisma.company.create({
      data: {
        name,
        members: {
          create: {
            userId: auth.userId,
            role: 'ADMIN' // creator is admin
          }
        }
      }
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
\);

// 3. Single Company API
ensureDir('src/app/api/companies/[id]');
fs.writeFileSync('src/app/api/companies/[id]/route.ts', \
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      invites: { where: { expiresAt: { gt: new Date() } } }
    }
  });

  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  
  // ensure user is a member
  const isMember = company.members.some(m => m.userId === auth.userId);
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ company });
}
\);

// 4. Invites Creation API
ensureDir('src/app/api/companies/[id]/invites');
fs.writeFileSync('src/app/api/companies/[id]/invites/route.ts', \
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { sendEmail, generateInviteHTML } from '@/lib/email';
import crypto from 'crypto';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const p = await req.json();
  const { email, role } = p;
  
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: auth.userId } },
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

  const inviteLink = \\\\/invite/\\\\;
  await sendEmail(email, \\\Invitation to join \\\\, generateInviteHTML(membership.company.name, inviteLink));

  return NextResponse.json({ invite }, { status: 201 });
}
\);

// 5. Invites Accept API
ensureDir('src/app/api/invites/[token]/accept');
fs.writeFileSync('src/app/api/invites/[token]/accept/route.ts', \
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

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
  
  if (invite.email.toLowerCase() !== auth.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'This invite was sent to a different email address' }, { status: 403 });
  }

  // Add member
  await prisma.([
    prisma.companyMember.upsert({
      where: { companyId_userId: { companyId: invite.companyId, userId: auth.userId } },
      update: { role: invite.role },
      create: { companyId: invite.companyId, userId: auth.userId, role: invite.role }
    }),
    prisma.companyInvite.delete({ where: { id: invite.id } })
  ]);

  return NextResponse.json({ success: true, companyId: invite.companyId });
}
\);

// 6. Delete member API
ensureDir('src/app/api/companies/[id]/members/[memberId]');
fs.writeFileSync('src/app/api/companies/[id]/members/[memberId]/route.ts', \
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string, memberId: string }> }) {
  const { id, memberId } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const requester = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: auth.userId } }
  });

  if (!requester || requester.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can remove members' }, { status: 403 });
  }

  if (auth.userId === memberId) {
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
\);

console.log('API routes created!');
