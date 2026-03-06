import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function verifyAuth(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.auth.getUser(authHeader.slice(7));
    if (error || !data.user) {
      res.status(401).json({ error: 'Sesión inválida o expirada' });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: 'Error de autenticación' });
    return false;
  }
}

const BUCKET = 'property-images';
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB after base64 decode

interface UploadBody {
  base64: string;
  filename?: string;
  contentType?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAuth(req, res))) return;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Base de datos no configurada (Supabase).' });
  }

  const body = req.body as UploadBody;
  const base64 = (body?.base64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!base64) {
    return res.status(400).json({ error: 'Se requiere body.base64 con la imagen en base64' });
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_SIZE) {
    return res.status(400).json({ error: 'La imagen supera el tamaño máximo de 5 MB' });
  }

  const contentType = body.contentType || 'image/jpeg';
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(contentType)) {
    return res.status(400).json({ error: `Tipo no permitido. Usa: ${allowedTypes.join(', ')}` });
  }

  let ext = 'jpg';
  if (contentType === 'image/png') ext = 'png';
  else if (contentType === 'image/webp') ext = 'webp';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const path = `${timestamp}-${random}.${ext}`;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType,
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return res.status(201).json({
      url: urlData.publicUrl,
      path,
    });
  } catch (err) {
    console.error('upload-image error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' });
  }
}
