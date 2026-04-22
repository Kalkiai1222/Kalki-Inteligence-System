import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken, verifyRefreshToken, signAccessToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function requireAuth() {
  const reqCookies = await cookies();
  let accessToken = reqCookies.get('accessToken')?.value;
  const refreshToken = reqCookies.get('refreshToken')?.value;

  if (!accessToken && !refreshToken) {
    return { error: 'Unauthorized', status: 401 };
  }

  let payload = accessToken ? verifyAccessToken(accessToken) as { userId: string } | null : null;

  if (!payload && refreshToken) {
    const refreshPayload = verifyRefreshToken(refreshToken) as { userId: string } | null;
    
    if (!refreshPayload) return { error: 'Session expired', status: 401 };

    const session = await prisma.session.findUnique({
      where: { refreshToken },
    });

    if (!session || session.expiresAt < new Date()) {
      return { error: 'Invalid or expired session', status: 401 };
    }

    accessToken = signAccessToken({ userId: refreshPayload.userId });
    
    try {
      reqCookies.set('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60,
        path: '/',
      });
    } catch (err) {
      // setting cookies in a GET route or server component can throw an error in Next.js
      console.warn('Could not set cookie in requireAuth', err);
    }
    
    payload = { userId: refreshPayload.userId };
  }

  if (!payload) return { error: 'Unauthorized', status: 401 };
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return { error: 'User not found', status: 404 };

  return { userId: payload.userId, user };
}