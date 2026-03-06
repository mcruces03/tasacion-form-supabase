import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function verifyAuth(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }

  try {
    const token = authHeader.slice(7);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.auth.getUser(token);

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
