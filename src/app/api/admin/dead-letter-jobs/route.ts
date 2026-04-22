import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userMemberships = await prisma.companyMember.findMany({
    where: { userId: auth.userId as string, role: 'ADMIN' },
    select: { companyId: true },
  });
  const companyIds = userMemberships.map((m) => m.companyId);
  if (companyIds.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const deadLetterJobs = await prisma.deadLetterJob.findMany({
    where: {
      job: {
        project: {
          companyId: { in: companyIds },
        },
      },
    },
    include: {
      job: {
        include: {
          project: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ deadLetterJobs });
}
