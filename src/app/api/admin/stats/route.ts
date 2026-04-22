import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // You might want to check if the user is a super admin here
    // For now, we'll allow any logged-in user to see stats for demonstration, 
    // or you could restrict it based on an 'isAdmin' flag if added to User model.

    const [userCount, companyCount, jobCount, activeJobs, completedJobs] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.job.count(),
      prisma.job.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.job.count({ where: { status: 'COMPLETED' } })
    ]);

    // Calculate revenue based on materials cost as a proxy
    const materials = await prisma.material.findMany({
      where: { cost: { not: null } }
    });
    
    const totalRevenue = materials.reduce((sum, mat) => sum + (mat.cost || 0), 0);

    return NextResponse.json({
      stats: {
        users: userCount,
        companies: companyCount,
        jobs: {
          total: jobCount,
          active: activeJobs,
          completed: completedJobs
        },
        revenue: totalRevenue
      }
    });

  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}