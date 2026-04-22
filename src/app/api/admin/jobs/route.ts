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
    const status = searchParams.get('status') || '';
    
    const whereClause: any = {
      name: { contains: search }
    };

    if (status) {
        whereClause.status = status;
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            name: true,
            company: {
                select: { name: true }
            }
          }
        },
        _count: {
          select: {
            materials: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error('Error fetching admin jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}