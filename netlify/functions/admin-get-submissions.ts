import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export const handler: Handler = async (event) => {
  try {
    const auth = event.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return json(401, { error: 'Unauthorized' });

    const supabase = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userRes, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !userRes?.user) return json(401, { error: 'Unauthorized' });

    const { data: profile, error: perr } = await supabase
      .from('user_profiles')
      .select('user_type')
      .eq('id', userRes.user.id)
      .single();

    if (perr || profile?.user_type !== 'admin') return json(403, { error: 'Forbidden' });

    // Inputs
    const page = Math.max(1, parseInt(event.queryStringParameters?.page || '1', 10));
    const pageSize = Math.min(100, parseInt(event.queryStringParameters?.pageSize || '50', 10));
    const status = (event.queryStringParameters?.status || 'all').toLowerCase();
    const q = event.queryStringParameters?.q || '';
    const date = event.queryStringParameters?.date || '';

    let query = supabase
      .from('reservations')
      .select(
        `*,
         verification_documents ( id, status, created_at, id_document_name, id_document_path, credit_card_name, credit_card_path, reviewed_by, reviewed_at ),
         digital_signatures ( signature_data )`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.contains('verification_documents', [{ status }]);
    if (q) query = query.or(`guest_name.ilike.%${q}%,email.ilike.%${q}%`);
    if (date) query = query.gte('created_at', `${date} 00:00:00`).lte('created_at', `${date} 23:59:59`);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await query.range(from, to);
    if (error) return json(500, { error: error.message });

    const items =
      (data ?? []).map((r: any) => {
        const v = r.verification_documents?.[0] || {};
        return {
          id: v.id || r.id,
          reservation_id: r.id,
          guest_name: r.guest_name || '',
          email: r.form_data?.email || 'N/A',
          check_in_date: r.check_in_date || '',
          check_out_date: r.check_out_date || '',
          booking_platform: r.booking_platform || '',
          reservation_amount: r.total_amount ?? 0,
          status: v.status || 'pending',
          created_at: v.created_at || r.created_at,
        };
      }) ?? [];

    return json(200, { items, page, pageSize });
  } catch (err: any) {
    console.error('admin-get-submissions error', err);
    return json(500, { error: 'Internal Server Error' });
  }
};

function json(status: number, body: any) {
  return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
