import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({
        plan: 'free',
        status: null,
        trialEnd: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        isActive: false,
        isTrial: false,
        isPastDue: false,
        isCanceled: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
    }

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !subscription) {
      return NextResponse.json({
        plan: 'free',
        status: null,
        trialEnd: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        isActive: false,
        isTrial: false,
        isPastDue: false,
        isCanceled: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
    }

    return NextResponse.json(subscription);
  } catch (error) {
    console.error('[subscriptions GET] Error:', error);
    return NextResponse.json({
      plan: 'free',
      status: null,
      trialEnd: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      isActive: false,
      isTrial: false,
      isPastDue: false,
      isCanceled: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });
  }
}
