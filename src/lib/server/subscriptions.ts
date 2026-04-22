import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Subscription = Database['public']['Tables']['subscriptions']['Row'];
type Organization = Database['public']['Tables']['organizations']['Row'];

const SUPERADMIN_EMAIL = 'romangulanyan@gmail.com';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

const SUPABASE_URL = supabaseUrl as string;
const SUPABASE_SERVICE_KEY = supabaseServiceKey as string;

async function verifySuperadmin(userId: string) {
  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: user, error } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) throw new Error('User not found');
  if (user.email.toLowerCase() !== SUPERADMIN_EMAIL) {
    throw new Error('Only the superadmin can perform this action');
  }
  return user;
}

export async function listAllWithSubscriptions(superadminUserId: string) {
  await verifySuperadmin(superadminUserId);

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: subs, error } = await supabaseService
    .from('subscriptions')
    .select('*');

  if (error) throw error;

  return Promise.all(
    (subs || []).map(async (sub) => {
      let org: Organization | null = null;
      if (sub.organization_id) {
        const { data: orgData } = await supabaseService
          .from('organizations')
          .select('*')
          .eq('id', sub.organization_id)
          .maybeSingle();
        org = orgData || null;
      }

      const { data: employees } = await supabaseService
        .from('users')
        .select('*')
        .eq('organization_id', sub.organization_id ?? '');

      const filteredEmployees = (employees || []).filter(
        (e) => e.role !== 'superadmin'
      );

      return {
        ...sub,
        organizationName: org?.name || 'Unknown',
        organizationSlug: org?.slug || '',
        employeeCount: filteredEmployees.length,
        isManual: sub.stripe_customerid.startsWith('manual_'),
        metadata: {
          customPrice: sub.stripe_subscriptionid.includes('manual') ? 49 : undefined,
        },
      };
    })
  );
}

export async function createManualSubscription(args: {
  superadminUserId: string;
  organizationId: string;
  plan: 'starter' | 'professional' | 'enterprise';
  customPrice?: number;
  notes?: string;
}) {
  await verifySuperadmin(args.superadminUserId);

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: org, error: orgError } = await supabaseService
    .from('organizations')
    .select('*')
    .eq('id', args.organizationId)
    .maybeSingle();

  if (orgError || !org) throw new Error('Organization not found');

  const { data: existing } = await supabaseService
    .from('subscriptions')
    .select('*')
    .eq('organization_id', args.organizationId)
    .maybeSingle();

  const now = Math.floor(Date.now() / 1000);
  const oneYearLater = now + 365 * 24 * 60 * 60;

  const subscriptionData = {
    organization_id: args.organizationId,
    plan: args.plan,
    status: 'active' as const,
    stripe_customerid: `manual_${args.organizationId}_${now}`,
    stripe_subscriptionid: `manual_sub_${args.organizationId}_${now}`,
    stripe_sessionid: null,
    current_period_end: oneYearLater,
    current_period_start: now,
    cancel_at_period_end: false,
    created_at: now,
    updated_at: now,
  };

  let result;
  if (existing) {
    const { data, error } = await supabaseService
      .from('subscriptions')
      .update(subscriptionData)
      .eq('id', existing.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to update subscription');
    result = { success: true, subscriptionId: data.id, action: 'updated' };

    await supabaseService
      .from('organizations')
      .update({ plan: args.plan })
      .eq('id', args.organizationId);
  } else {
    const { data, error } = await supabaseService
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create subscription');
    result = { success: true, subscriptionId: data.id, action: 'created' };

    await supabaseService
      .from('organizations')
      .update({ plan: args.plan })
      .eq('id', args.organizationId);
  }

  return result;
}

export async function cancelSubscription(args: {
  superadminUserId: string;
  subscriptionId: string;
}) {
  await verifySuperadmin(args.superadminUserId);

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { error } = await supabaseService
    .from('subscriptions')
    .update({
      status: 'canceled',
      cancel_at_period_end: true,
      updated_at: Math.floor(Date.now() / 1000),
    })
    .eq('id', args.subscriptionId);

  if (error) throw error;
  return { success: true };
}
