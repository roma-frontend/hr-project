import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAuth } from '@/lib/api-utils';

export async function GET(_req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabaseService = createServiceClient();
    const { data: userProfile } = await supabaseService
      .from('users')
      .select('organization_id')
      .eq('id', auth.user.id)
      .maybeSingle();

    const orgId = userProfile?.organization_id;

    if (!orgId) {
      return NextResponse.json({ isActive: false });
    }

    const supabase = await createClient();
    const { data: maintenanceData } = await supabase
      .from('maintenance_modes')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const isActive = maintenanceData?.is_active === true && 
      maintenanceData.start_time <= Date.now();

    return NextResponse.json({ isActive });
  } catch (error) {
    console.error('Maintenance check error:', error);
    return NextResponse.json({ isActive: false });
  }
}
