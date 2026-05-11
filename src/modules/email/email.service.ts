import { Resend } from 'resend';
import { ENV } from '../../config/env';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(ENV.RESEND_API_KEY || 'placeholder');
  return _resend;
}

function verificationEmailHtml(username: string, verifyUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#1a1a2e">Bem-vindo ao Kardum, ${username}!</h2>
      <p>Confirme seu endereço de email para ativar sua conta:</p>
      <a href="${verifyUrl}"
         style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">
        Confirmar Email
      </a>
      <p style="color:#666;font-size:13px">O link expira em <strong>24 horas</strong>. Se você não criou uma conta, ignore este email.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="color:#999;font-size:12px">Kardum Online &mdash; este email foi gerado automaticamente, não responda.</p>
    </div>`;
}

function welcomeEmailHtml(username: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#1a1a2e">Conta verificada, ${username}!</h2>
      <p>Sua conta está ativa. Bom jogo!</p>
      <a href="${ENV.FRONTEND_URL}"
         style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">
        Jogar agora
      </a>
    </div>`;
}

export class EmailService {
  async sendVerificationEmail(to: string, username: string, token: string): Promise<void> {
    if (!ENV.RESEND_API_KEY) {
      console.warn('[Email] RESEND_API_KEY not set — skipping verification email to', to);
      return;
    }
    const verifyUrl = `${ENV.FRONTEND_URL}/verify-email?token=${token}`;
    await getResend().emails.send({
      from: ENV.EMAIL_FROM,
      to,
      subject: 'Confirme seu email — Kardum',
      html: verificationEmailHtml(username, verifyUrl)
    });
  }

  async sendWelcomeEmail(to: string, username: string): Promise<void> {
    if (!ENV.RESEND_API_KEY) return;
    await getResend().emails.send({
      from: ENV.EMAIL_FROM,
      to,
      subject: 'Conta ativada — Kardum',
      html: welcomeEmailHtml(username)
    });
  }
}

export default new EmailService();
