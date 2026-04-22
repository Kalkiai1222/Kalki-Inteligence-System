import { prisma } from './prisma';
import { sendEmail } from './email';

export async function createNotification({
  userId,
  companyId,
  title,
  message,
  type = 'INFO',
  link,
  sendEmailNotification = false,
}: {
  userId: string;
  companyId?: string;
  title: string;
  message: string;
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  link?: string;
  sendEmailNotification?: boolean;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      companyId,
      title,
      message,
      type,
      link,
    },
  });

  if (sendEmailNotification) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.email) {
      await sendEmail(
        user.email,
        title,
        `${message}<br/><br/>View details: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
      );
    }
  }

  return notification;
}

export async function markNotificationAsRead(id: string, userId: string) {
  return await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function getNotifications(userId: string, unreadOnly = false) {
  return await prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}
