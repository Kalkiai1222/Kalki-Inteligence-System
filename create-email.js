const fs = require('fs');
const content = \import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER || 'test-user',
    pass: process.env.SMTP_PASS || 'test-pass',
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const info = await transporter.sendMail({
      from: '"Construction AI" <noreply@construction.ai>',
      to,
      subject,
      html,
    });
    console.log('Message sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export const generateEmailVerificationHTML = (link: string) => \\\
  <div>
    <h1>Verify Your Email</h1>
    <p>Please click the link below to verify your email address.</p>
    <a href="\\\">\\\</a>
  </div>
\\\;

export const generatePasswordResetHTML = (link: string) => \\\
  <div>
    <h1>Password Reset</h1>
    <p>Please click the link below to reset your password. It expires in 1 hour.</p>
    <a href="\\\">\\\</a>
  </div>
\\\;
\;

fs.writeFileSync('src/lib/email.ts', content, 'utf8');
