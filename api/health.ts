import type { VercelRequest, VercelResponse } from '@vercel/node';

const emailUser = (process.env.EMAIL_USER || '').trim();
const gmailOauthOk =
  !!emailUser &&
  !!process.env.GMAIL_CLIENT_ID &&
  !!process.env.GMAIL_CLIENT_SECRET &&
  !!process.env.GMAIL_REFRESH_TOKEN;
const supabaseOk =
  Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    emailConfigured: gmailOauthOk,
    databaseConfigured: supabaseOk,
  });
}
