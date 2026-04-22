import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { getAuditLogs } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: companyId } = await params;

    // Verify member permissions
    const member = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: auth.userId as string,
        },
      },
    });

    if (!member || member.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Requires ADMIN role.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const logs = await getAuditLogs(companyId, limit, offset);
    
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
