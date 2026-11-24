import { EMAIL_USER } from '../../config/env.js';

// Brevo's HTTPS API works on hosts that block outbound SMTP.
export const brevoTransport = (apiKey) => ({
  sendMail: async ({ to, subject, html, text }) => {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_FROM || EMAIL_USER, name: 'Labzy' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Brevo send failed: ${res.status}`);
  },
});
