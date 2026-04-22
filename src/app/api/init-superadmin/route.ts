import { NextResponse } from 'next/server';
import { ensureSuperadminExists } from '@/actions/auth';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const allowInit = process.env.ALLOW_SUPERADMIN_INIT === 'true' || process.env.NODE_ENV === 'development';
  
  if (!allowInit) {
    return NextResponse.json(
      { success: false, error: 'Superadmin initialization is disabled in production' },
      { status: 403 }
    );
  }

  const supabaseService = createServiceClient();
  const { data: existingSuperadmin } = await supabaseService
    .from('users')
    .select('id')
    .eq('role', 'superadmin')
    .maybeSingle();

  if (existingSuperadmin) {
    return NextResponse.json(
      { success: false, error: 'Superadmin already exists. Initialization is a one-time operation.' },
      { status: 409 }
    );
  }

  try {
    const result = await ensureSuperadminExists();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[init-superadmin] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize superadmin' },
      { status: 500 }
    );
  }
}
