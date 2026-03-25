import { createClient } from '@supabase/supabase-js';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: 'Server configuration error' });
  }

  try {
    const auth = request.headers.get('authorization') || '';
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

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, parseInt(url.searchParams.get('pageSize') || '50', 10));
    const status = (url.searchParams.get('status') || 'all').toLowerCase();
    const q = url.searchParams.get('q') || '';
    const date = url.searchParams.get('date') || '';

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

function json<T>(status: number, body: T): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
