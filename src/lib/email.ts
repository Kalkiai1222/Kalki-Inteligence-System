
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER || 'test-user',
    pass: process.env.SMTP_PASSWORD || 'test-pass',
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Kalki Intelligence" <noreply@kalki-intelligence.com>',
      to,
      subject,
      html,
    });
    console.log('Message sent: %s', info.messageId);
    if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export const generateEmailVerificationHTML = (link: string) => '<a href=' + link + '>' + link + '</a>';
export const generatePasswordResetHTML = (link: string) => '<a href=' + link + '>' + link + '</a>';
export const generateInviteHTML = (companyName: string, link: string) => `
<p>You have been invited to join <strong>${companyName}</strong> on Kalki Intelligence.</p>
<p>Click the link below to accept the invitation:</p>
<p><a href="${link}">${link}</a></p>
`;

