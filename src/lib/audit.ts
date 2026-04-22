import { prisma } from './prisma';

export async function createAuditLog({
  userId,
  companyId,
  action,
  resourceType,
  resourceId,
  changes,
  ipAddress,
  userAgent,
  status = 'SUCCESS',
  errorMessage,
}: {
  userId: string;
  companyId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
}) {
  return await prisma.auditLog.create({
    data: {
      userId,
      companyId,
      action,
      resourceType,
      resourceId,
      changes: changes ? JSON.stringify(changes) : null,
      ipAddress,
      userAgent,
      status,
      errorMessage,
    },
  });
}

export async function getAuditLogs(companyId?: string, limit = 50, offset = 0) {
    return await prisma.auditLog.findMany({
        where: companyId ? { companyId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                }
            }
        }
    });
}
