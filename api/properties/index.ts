import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '../../lib/auth';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!(await verifyAuth(req, res))) return;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Base de datos no configurada (Supabase).' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('properties')
      .select('id, internal_id, direccion, status, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase properties list error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST') {
    const body = req.body as { form?: Record<string, unknown> };
    const form = body?.form;
    if (!form || typeof form !== 'object') {
      return res.status(400).json({ error: 'Se requiere body.form con los datos del formulario' });
    }
    const operacion = typeof form.operacion === 'string' ? form.operacion : 'sell';
    const initialStatus = operacion === 'rent' ? 'to_rent' : 'to_sell';
    const { data, error } = await supabase
      .from('properties')
      .insert({ data: form, status: initialStatus })
      .select('id, internal_id, direccion, status, created_at')
      .single();
    if (error) {
      console.error('Supabase properties insert error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
