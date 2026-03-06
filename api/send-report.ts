import type { VercelRequest, VercelResponse } from '@vercel/node';
import multiparty from 'multiparty';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const emailUser = (process.env.EMAIL_USER || '').trim();
const gmailClientId = process.env.GMAIL_CLIENT_ID || '';
const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET || '';
const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN || '';
const gmailOauthConfigured = !!(
  emailUser &&
  gmailClientId &&
  gmailClientSecret &&
  gmailRefreshToken
);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getGmailClient() {
  const auth = new google.auth.OAuth2(gmailClientId, gmailClientSecret);
  auth.setCredentials({ refresh_token: gmailRefreshToken });
  return google.gmail({ version: 'v1', auth });
}

function buildMimeMessage(
  from: string,
  to: string,
  subject: string,
  html: string,
  attachments: Array<{ filename: string; content: Buffer }>
): Buffer {
  const boundary = '----=_Part_' + Date.now();
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ];
  for (const att of attachments) {
    const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content);
    const mimeType = att.filename?.endsWith('.pdf')
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    lines.push(
      `--${boundary}`,
      `Content-Disposition: attachment; filename="${att.filename || 'file'}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Type: ${mimeType}`,
      '',
      buf.toString('base64')
    );
  }
  lines.push(`--${boundary}--`);
  return Buffer.from(lines.join('\r\n'), 'utf8');
}

async function sendViaGmailApi(
  to: string,
  subject: string,
  html: string,
  attachments: Array<{ filename: string; content: Buffer }>
): Promise<void> {
  const gmail = getGmailClient();
  const from = `"Valoración" <${emailUser}>`;
  const raw = buildMimeMessage(from, to, subject, html, attachments);
  const rawBase64Url = raw
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawBase64Url },
  });
}

function parseForm(
  req: VercelRequest
): Promise<{
  fields: Record<string, string[]>;
  files: Record<string, { path: string; originalFilename?: string }[]>;
}> {
  return new Promise((resolve, reject) => {
    const form = new multiparty.Form({ maxFieldsSize: 10 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({
        fields: (fields || {}) as Record<string, string[]>,
        files: (files || {}) as Record<string, { path: string; originalFilename?: string }[]>,
      });
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fields, files } = await parseForm(req);
    const email = (fields?.email?.[0] || '').trim();
    const formJson = fields?.form?.[0] || '';
    const pdfFile = files?.pdf?.[0];
    const xlsxFile = files?.xlsx?.[0];

    if (!email) {
      return res.status(400).json({ error: 'Email es obligatorio' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email no válido' });
    }
    if (!pdfFile || !xlsxFile) {
      return res.status(400).json({ error: 'Faltan archivos PDF o Excel' });
    }
    if (!gmailOauthConfigured) {
      return res.status(503).json({
        error:
          'Email no configurado. Añade EMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET y GMAIL_REFRESH_TOKEN (ver DEPLOY.md).',
      });
    }

    let formData: Record<string, unknown> | null = null;
    if (formJson) {
      try {
        formData = JSON.parse(formJson) as Record<string, unknown>;
      } catch {
        // optional: store without form data
      }
    }

    // Save to Supabase if configured
    if (supabaseUrl && supabaseServiceKey && formData) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { error: insertError } = await supabase.from('valoraciones').insert({
        data: formData,
        email_sent_to: email,
      });
      if (insertError) {
        console.error('Supabase insert error:', insertError);
      }
    }

    const pdfBuffer = readFileSync(pdfFile.path);
    const xlsxBuffer = readFileSync(xlsxFile.path);
    const baseName =
      formData && typeof formData.direccion === 'string'
        ? `valoracion-${String(formData.direccion).replace(/\s+/g, '_').substring(0, 30)}`
        : 'valoracion-inmueble';

    const subject = 'Valoración de inmueble - Informe';
    const html = '<p>Adjunto encontrará el informe de valoración en PDF y Excel.</p>';
    const attachments = [
      { filename: `${baseName}.pdf`, content: pdfBuffer },
      { filename: `${baseName}.xlsx`, content: xlsxBuffer },
    ];

    await sendViaGmailApi(email, subject, html, attachments);

    return res.status(200).json({ success: true, message: 'Informe enviado correctamente' });
  } catch (err) {
    console.error('send-report error:', err);
    const msg = err instanceof Error ? err.message : 'Error interno';
    const code = (err as { code?: string })?.code?.toLowerCase() || '';
    let userMessage = msg;
    if (
      code === 'eauth' ||
      msg.includes('Invalid login') ||
      msg.includes('authentication')
    ) {
      userMessage =
        'Email no configurado correctamente. Usa OAuth2 (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN) y obtén el refresh token con el script get-gmail-oauth-token.js.';
    }
    return res.status(500).json({ error: userMessage });
  }
}
