import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // verify permission
  const member = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: auth.userId as string } }
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const notifications = await prisma.notification.findMany({
    where: { companyId: id, userId: auth.userId as string },
    orderBy: { createdAt: 'desc' },
    take: 50 // Limit to avoid massive payloads
  });

  return NextResponse.json({ notifications });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const { notificationIds } = body; // Array of IDs to mark read

  if (!notificationIds || !Array.isArray(notificationIds)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const result = await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      companyId: id,
      userId: auth.userId as string
    },
    data: {
      isRead: true
    }
  });

  return NextResponse.json({ success: true, count: result.count });
}