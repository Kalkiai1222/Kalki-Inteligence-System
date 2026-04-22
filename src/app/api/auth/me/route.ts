import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken, verifyRefreshToken, signAccessToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    let accessToken = (await cookies()).get('accessToken')?.value;
    const refreshToken = (await cookies()).get('refreshToken')?.value;

    if (!accessToken && !refreshToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload = accessToken ? verifyAccessToken(accessToken) as { userId: string } | null : null;

    // Access token expired or doesn't exist, try refresh token
    if (!payload && refreshToken) {
      const refreshPayload = verifyRefreshToken(refreshToken) as { userId: string } | null;
      
      if (!refreshPayload) {
        return NextResponse.json({ error: 'Session expired' }, { status: 401 });
      }

      const session = await prisma.session.findUnique({
        where: { refreshToken },
      });

      if (!session || session.expiresAt < new Date()) {
        return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
      }

      // issue new access token
      accessToken = signAccessToken({ userId: refreshPayload.userId });
      
      (await cookies()).set('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60,
        path: '/',
      });
      
      payload = { userId: refreshPayload.userId };
    }

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
