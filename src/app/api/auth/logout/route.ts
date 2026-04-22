import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const refreshToken = (await cookies()).get('refreshToken')?.value;

    if (refreshToken) {
      // Invalidate the session in out DB
      await prisma.session.deleteMany({
        where: { refreshToken },
      });
    }

    (await cookies()).delete('accessToken');
    (await cookies()).delete('refreshToken');

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
