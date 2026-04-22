import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const companies = await prisma.company.findMany({
      where: { members: { some: { userId: Object(auth).userId } } },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ companies });
  } catch (err: any) {
    console.error('Company GET Error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { name } = await req.json();
    if (!name || name.length < 2) return NextResponse.json({ error: 'Company name must be at least 2 characters long' }, { status: 400 });

    const company = await prisma.company.create({
      data: {
        name,
        members: {
          create: {
            userId: Object(auth).userId,
            role: 'ADMIN' // creator is admin
          }
        }
      }
    });

    await createAuditLog({
      userId: Object(auth).userId,
      companyId: company.id,
      action: 'CREATE_COMPANY',
      resourceType: 'Company',
      resourceId: company.id,
      changes: { name },
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}