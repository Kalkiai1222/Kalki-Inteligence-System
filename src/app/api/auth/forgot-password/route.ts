import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { z } from 'zod';
import { sendEmail, generatePasswordResetHTML } from '@/lib/email';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const { email } = forgotPasswordSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email } });
    
    // Always return success even if user not found to prevent user enumeration
    if (!user) {
      return NextResponse.json({ message: 'If that email exists in our system, we have sent a reset link to it.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    await sendEmail(
      user.email,
      'Password Reset - Kalki Intelligence',
      generatePasswordResetHTML(resetUrl)
    );

    return NextResponse.json({ message: 'If that email exists in our system, we have sent a reset link to it.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten().fieldErrors }, { status: 400 });
    }
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
