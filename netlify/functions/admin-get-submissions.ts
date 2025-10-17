import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export const handler: Handler = async (event) => {
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase environment variables for admin-get-submissions');
    return json(500, { error: 'Server configuration error' });
  }
  try {
    const auth = event.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return json(401, { error: 'Unauthorized' });

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: userRes, error: uerr } = await supabaseAdmin.auth.getUser(token);
    if (uerr || !userRes?.user) return json(401, { error: 'Unauthorized' });

    const { data: profile, error: perr } = await supabaseAdmin
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

    let query = supabaseAdmin
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

    type VerificationDocument = {
      id?: string | null;
      status?: string | null;
      created_at?: string | null;
    };

    type ReservationRow = {
      id: string;
      guest_name?: string | null;
      form_data?: { email?: string | null } | null;
      check_in_date?: string | null;
      check_out_date?: string | null;
      booking_platform?: string | null;
      total_amount?: number | null;
      created_at?: string | null;
      verification_documents?: VerificationDocument[] | null;
    };

    const typedData: ReservationRow[] = Array.isArray(data) ? data : [];

    const items = typedData.map((row) => {
      const document: VerificationDocument = row.verification_documents?.[0] ?? {};
      return {
        id: document.id ?? row.id,
        reservation_id: row.id,
        guest_name: row.guest_name ?? '',
        email: row.form_data?.email ?? 'N/A',
        check_in_date: row.check_in_date ?? '',
        check_out_date: row.check_out_date ?? '',
        booking_platform: row.booking_platform ?? '',
        reservation_amount: row.total_amount ?? 0,
        status: document.status ?? 'pending',
        created_at: document.created_at ?? row.created_at ?? '',
      };
    });

    return json(200, { items, page, pageSize });
  } catch (err: unknown) {
    console.error('admin-get-submissions error', err);
    return json(500, { error: 'Internal Server Error' });
  }
};

function json<T>(status: number, body: T) {
  return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
