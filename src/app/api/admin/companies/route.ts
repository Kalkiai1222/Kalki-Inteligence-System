import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';
    
    const companies = await prisma.company.findMany({
      where: {
        name: { contains: search }
      },
      include: {
        _count: {
          select: {
            members: true,
            projects: true
          }
        },
        members: {
          where: { role: 'ADMIN' },
          include: {
            user: {
              select: { name: true, email: true }
            }
          },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ companies });
  } catch (error: any) {
    console.error('Error fetching admin companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}