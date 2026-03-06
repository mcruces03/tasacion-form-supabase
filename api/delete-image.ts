import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const BUCKET = 'property-images';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Base de datos no configurada (Supabase).' });
  }

  const body = req.body as { path?: string };
  const filePath = (body?.path || '').trim();
  if (!filePath) {
    return res.status(400).json({ error: 'Se requiere body.path con la ruta del archivo' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) {
      console.error('Supabase storage delete error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('delete-image error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' });
  }
}
