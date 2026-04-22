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
      invites: { where: { expiresAt: { gt: new Date() } } },
      clients: { select: { id: true, name: true } },
      projects: { 
        include: { 
          blueprintSets: { include: { versions: true } } 
        } 
      }
    }
  });

  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  
  // ensure user is a member
  const isMember = company.members.some((m: any) => m.userId === auth.userId);
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ company });
}