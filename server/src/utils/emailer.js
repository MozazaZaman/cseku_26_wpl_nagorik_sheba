import nodemailer from 'nodemailer';

/**
 * Email notifications for workflow transitions.
 *
 * Modes (first match wins):
 *  1. SMTP_URL env (any SMTP relay, e.g. Gmail app-password) - real email
 *  2. ETHEREAL=1 / no config at all - Ethereal fake SMTP account; messages
 *     are captured and a preview URL is printed in the server log.
 *
 * Without configuration the module never blocks or crashes the API -
 * every send failure is logged and swallowed.
 */

let transporter = null;
let mode = 'disabled';

export async function initEmailer() {
  if (transporter !== null) return;
  try {
    if (process.env.SMTP_URL) {
      transporter = nodemailer.createTransport(process.env.SMTP_URL);
      mode = 'smtp';
    } else {
      // Ethereal: a free disposable SMTP provider built for testing.
      const account = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass }
      });
      mode = `ethereal (${account.user})`;
    }
    console.log(`Emailer ready — mode: ${mode}`);
  } catch (e) {
    console.log('Emailer disabled:', e.message);
    transporter = null;
    mode = 'disabled';
  }
}

export function emailerMode() {
  return mode;
}

export async function sendMail({ to, subject, text }) {
  if (!to) return;
  if (!transporter) {
    console.log(`[email:disabled] to=${to} subject="${subject}"`);
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: '"Nagorik Sheba" <no-reply@nagorik-sheba.bd>',
      to,
      subject,
      text
    });
    if (mode.startsWith('ethereal')) {
      console.log(`[email:ethereal] "${subject}" -> ${to} preview: ${nodemailer.getTestMessageUrl(info)}`);
    } else {
      console.log(`[email:smtp] "${subject}" -> ${to}`);
    }
  } catch (e) {
    console.log(`[email:failed] "${subject}" -> ${to}: ${e.message}`);
  }
}
