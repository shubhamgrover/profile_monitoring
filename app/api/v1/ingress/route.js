import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { token, path, referrer, test } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400, headers: corsHeaders() });
    }

    // 1. Verify token ownership against database
    const { data: tracker, error: trackerErr } = await supabaseAdmin
      .from('client_trackers')
      .select('id, user_id')
      .eq('id', token)
      .single();

    if (trackerErr || !tracker) {
      return NextResponse.json({ error: 'Invalid tracking token ID' }, { status: 403, headers: corsHeaders() });
    }

    // 2. Handle Simulation/Test Mode
    if (test) {
      const { error: insertErr } = await supabaseAdmin.from('visitor_logs').insert({
        tracker_id: tracker.id,
        user_id: tracker.user_id,
        company_name: 'Stripe, Inc. (Test)',
        company_domain: 'stripe.com',
        page_path: path || '/',
        referrer: referrer || 'Test Simulation'
      });

      if (insertErr) {
        console.error('Error inserting test visitor log:', insertErr);
        throw insertErr;
      }

      return NextResponse.json({ success: true, test: true }, { 
        status: 200,
        headers: corsHeaders()
      });
    }

    // 3. Capture the visitor's IP address safely behind Vercel's proxy headers
    const visitorIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                      req.headers.get('x-real-ip') || 
                      '127.0.0.1';

    // In local development, use Stripe's IP address for demonstration
    let targetIp = visitorIp;
    if (targetIp === '127.0.0.1' || targetIp === '::1' || targetIp.startsWith('192.168.') || targetIp.startsWith('10.')) {
      targetIp = '13.111.23.4'; // Stripe Corporate IP
    }

    // 4. Query the ipapi.is B2B enrichment service using the secure API key
    const ipapiKey = process.env.IPAPI_KEY || 'ee0e4f03d78c955b4983';
    const ipapiRes = await fetch(`https://api.ipapi.is?ip=${targetIp}&key=${ipapiKey}`);
    
    if (!ipapiRes.ok) {
      throw new Error(`ipapi.is returned status ${ipapiRes.status}`);
    }

    const ipData = await ipapiRes.json();

    // 5. Filter out residential ISPs and hosting/datacenter networks to isolate corporate visitors
    if (ipData.company && ipData.company.name && ipData.company.type && ipData.company.type !== 'isp' && ipData.company.type !== 'hosting') {
      const companyName = ipData.company.name;
      const companyDomain = ipData.company.domain;

      // 6. Write validated B2B hit record into visitor_logs
      const { error: insertErr } = await supabaseAdmin.from('visitor_logs').insert({
        tracker_id: tracker.id,
        user_id: tracker.user_id,
        company_name: companyName,
        company_domain: companyDomain,
        page_path: path || '/',
        referrer: referrer || ''
      });

      if (insertErr) {
        console.error('Error inserting visitor log:', insertErr);
        throw insertErr;
      }
    }

    return NextResponse.json({ success: true }, { 
      status: 200,
      headers: corsHeaders()
    });
  } catch (err) {
    console.error('Ingress internal error:', err);
    return NextResponse.json({ error: 'Processing error' }, { 
      status: 500,
      headers: corsHeaders()
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
