import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '../lib/auth';

const emailUser = (process.env.EMAIL_USER || '').trim();
const gmailClientId = process.env.GMAIL_CLIENT_ID || '';
const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET || '';
const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN || '';
const gmailOauthConfigured = !!(
  emailUser && gmailClientId && gmailClientSecret && gmailRefreshToken
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
  const from = `"Valoracion" <${emailUser}>`;
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

interface SendReportBody {
  email?: string;
  form?: Record<string, unknown>;
  property_id?: string;
  pdfBase64?: string;
  xlsxBase64?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await verifyAuth(req, res))) return;

  try {
    const body = req.body as SendReportBody;
    const email = (body?.email || '').trim();
    const formData = body?.form || null;
    const pdfBase64 = body?.pdfBase64 || '';
    const xlsxBase64 = body?.xlsxBase64 || '';
    const submittedPropertyId = (body?.property_id || '').trim() || null;

    if (!email) {
      return res.status(400).json({ error: 'Email es obligatorio' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email no válido' });
    }
    if (!pdfBase64 || !xlsxBase64) {
      return res.status(400).json({ error: 'Faltan archivos PDF o Excel (base64)' });
    }
    if (!gmailOauthConfigured) {
      return res.status(503).json({
        error:
          'Email no configurado. Añade EMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET y GMAIL_REFRESH_TOKEN (ver DEPLOY.md).',
      });
    }

    // Save to Supabase: upsert property + create valoracion snapshot
    let propertyId: string | null = null;
    if (supabaseUrl && supabaseServiceKey && formData) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      if (submittedPropertyId) {
        const { error: updateErr } = await supabase
          .from('properties')
          .update({ data: formData })
          .eq('id', submittedPropertyId);
        if (updateErr) console.error('Supabase property update error:', updateErr);
        propertyId = submittedPropertyId;
      } else {
        const operacion = typeof formData.operacion === 'string' ? formData.operacion : 'sell';
        const initialStatus = operacion === 'rent' ? 'to_rent' : 'to_sell';
        const { data: newProp, error: insertErr } = await supabase
          .from('properties')
          .insert({ data: formData, status: initialStatus })
          .select('id')
          .single();
        if (insertErr) console.error('Supabase property insert error:', insertErr);
        propertyId = newProp?.id ?? null;
      }

      const { error: valErr } = await supabase.from('valoraciones').insert({
        data: formData,
        email_sent_to: email,
        property_id: propertyId,
      });
      if (valErr) console.error('Supabase valoracion insert error:', valErr);
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const xlsxBuffer = Buffer.from(xlsxBase64, 'base64');
    const inmuebleName =
      formData && typeof formData.direccion === 'string' && formData.direccion.trim()
        ? String(formData.direccion).trim()
        : 'Inmueble';
    const baseName = `valoracion-${inmuebleName.replace(/\s+/g, '_').substring(0, 30)}`;
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const dateStr = `${dd}/${mm}/${yy}`;

    const subject = `Valoracion del inmueble ${inmuebleName} - Informe ${dateStr}`;
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
    const rawCode = (err as { code?: string | number })?.code;
    const code = typeof rawCode === 'string' ? rawCode.toLowerCase() : String(rawCode ?? '');
    let userMessage = msg;
    if (
      code === 'eauth' ||
      code === '401' ||
      msg.includes('Invalid login') ||
      msg.includes('authentication') ||
      msg.includes('unauthorized_client')
    ) {
      userMessage =
        'Email no configurado correctamente. Usa OAuth2 (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN) y obtén el refresh token con el script get-gmail-oauth-token.js.';
    }
    return res.status(500).json({ error: userMessage });
  }
}
