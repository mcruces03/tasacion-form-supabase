import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getIdFromRequest(req: VercelRequest): string | null {
  const id = (req as { query?: { id?: string } }).query?.id;
  if (id) return id;
  const url = req.url || '';
  const match = url.match(/\/api\/properties\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const id = getIdFromRequest(req);
  if (!id) {
    return res.status(400).json({ error: 'Falta id de la propiedad' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Base de datos no configurada (Supabase).' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Propiedad no encontrada' });
      }
      console.error('Supabase properties get error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
    const body = req.body as { form?: Record<string, unknown> };
    const form = body?.form;
    if (!form || typeof form !== 'object') {
      return res.status(400).json({ error: 'Se requiere body.form con los datos del formulario' });
    }
    const { data, error } = await supabase
      .from('properties')
      .update({ data: form })
      .eq('id', id)
      .select('id, internal_id, direccion, updated_at')
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Propiedad no encontrada' });
      }
      console.error('Supabase properties update error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);
  }

  const VALID_STATUSES = ['to_sell', 'sold', 'cancelled', 'to_rent', 'rented', 'pending'];

  if (req.method === 'PATCH') {
    const body = req.body as { status?: string };
    const status = body?.status;
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}` });
    }
    const { data, error } = await supabase
      .from('properties')
      .update({ status })
      .eq('id', id)
      .select('id, internal_id, status, updated_at')
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Propiedad no encontrada' });
      }
      console.error('Supabase properties status update error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { data: prop } = await supabase
      .from('properties')
      .select('data')
      .eq('id', id)
      .single();

    const fotos = Array.isArray(prop?.data?.fotos) ? (prop.data.fotos as string[]) : [];
    if (fotos.length > 0) {
      const bucket = 'property-images';
      const marker = `/storage/v1/object/public/${bucket}/`;
      const paths = fotos
        .map((url: string) => {
          const idx = url.indexOf(marker);
          return idx !== -1 ? url.substring(idx + marker.length) : null;
        })
        .filter((p): p is string => p !== null);

      if (paths.length > 0) {
        const { error: storageErr } = await supabase.storage.from(bucket).remove(paths);
        if (storageErr) console.error('Storage cleanup error:', storageErr);
      }
    }

    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Propiedad no encontrada' });
      }
      console.error('Supabase properties delete error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
