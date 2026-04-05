import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

const isDev = process.env.NODE_ENV === 'development';

async function verifySuperadmin(req: NextRequest): Promise<boolean> {
  if (isDev) return true;

  try {
    // Get the Convex token from the request cookie
    const convexToken = req.cookies.get('__convex_token')?.value;

    if (!convexToken) return false;

    // Verify with Convex using getCurrentUser
    const user = await fetchQuery(
      api.users.getCurrentUser,
      {},
      {
        token: convexToken,
      },
    );

    if (!user) return false;

    const SUPERADMIN_EMAIL = 'romangulanyan@gmail.com';
    return user.email?.toLowerCase() === SUPERADMIN_EMAIL || user.role === 'superadmin';
  } catch (error) {
    console.error('[Stripe Auth] Error:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!(await verifySuperadmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Get charges (payments)
    const charges = await stripe.charges.list({ limit });

    // Get subscriptions
    const subscriptions = await stripe.subscriptions.list({
      limit: 100,
      status: 'all',
      expand: ['data.customer', 'data.items.data.price'],
    });

    // Calculate metrics
    const now = Date.now();
    const lastMonth = now - 30 * 24 * 60 * 60 * 1000;

    const activeSubs = subscriptions.data.filter((s) => s.status === 'active');
    const trialingSubs = subscriptions.data.filter((s) => s.status === 'trialing');
    const canceledSubs = subscriptions.data.filter((s) => s.status === 'canceled');
    const pastDueSubs = subscriptions.data.filter((s) => s.status === 'past_due');

    // Calculate MRR
    const planPrices: Record<string, number> = {
      price_starter: 0,
      price_professional: 29,
      price_enterprise: 199,
    };

    let mrr = 0;
    activeSubs.forEach((sub) => {
      const priceId = sub.items.data[0]?.price?.id || '';
      const price = planPrices[priceId] || 29; // default to professional
      mrr += price;
    });

    // Calculate total revenue from charges
    const totalRevenue = charges.data
      .filter((c) => c.status === 'succeeded')
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    // Last 30 days revenue
    const last30DaysRevenue = charges.data
      .filter((c) => c.status === 'succeeded' && c.created * 1000 > lastMonth)
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    // Growth calculation
    const last60Days = now - 60 * 24 * 60 * 60 * 1000;
    const recentSubs = subscriptions.data.filter((s) => s.created * 1000 > lastMonth);
    const olderSubs = subscriptions.data.filter(
      (s) => s.created * 1000 > last60Days && s.created * 1000 <= lastMonth,
    );
    const growth =
      olderSubs.length > 0
        ? (((recentSubs.length - olderSubs.length) / olderSubs.length) * 100).toFixed(1)
        : '0.0';

    // Trial ending soon (within 7 days)
    const trialEnding = subscriptions.data.filter((sub) => {
      if (sub.status !== 'trialing' || !sub.trial_end) return false;
      const daysLeft = Math.ceil((sub.trial_end - now / 1000) / (60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 7;
    });

    // Recent transactions
    const recentTransactions = charges.data.slice(0, 100).map((charge) => {
      const cardDetails = charge.payment_method_details?.card;
      return {
        id: charge.id,
        amount: (charge.amount || 0) / 100,
        currency: charge.currency.toUpperCase(),
        status: charge.status,
        customer: charge.billing_details?.email || charge.billing_details?.name || 'N/A',
        date: new Date(charge.created * 1000).toISOString(),
        description: charge.description || 'Subscription payment',
        // Card details for support
        cardLast4: cardDetails?.last4 || null,
        cardBrand: cardDetails?.brand || null,
        cardExp:
          cardDetails?.exp_month && cardDetails?.exp_year
            ? `${cardDetails.exp_month}/${cardDetails.exp_year}`
            : null,
        receiptUrl: charge.receipt_url,
      };
    });

    // Subscriptions with customer info
    const subscriptionList = subscriptions.data.map((sub) => {
      const customer = sub.customer as Stripe.Customer;
      const price = sub.items.data[0]?.price;
      const priceId = price?.id || '';
      const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
      const subAny = sub as any;

      return {
        id: sub.id,
        status: sub.status,
        plan: price?.nickname || priceId || 'unknown',
        amount,
        customer: {
          email: (customer as any).email || 'N/A',
          name: (customer as any).name || 'N/A',
        },
        currentPeriodEnd: subAny.current_period_end * 1000,
        currentPeriodStart: subAny.current_period_start * 1000,
        cancelAtPeriodEnd: sub.cancel_at_period_end || false,
        trialEnd: subAny.trial_end ? subAny.trial_end * 1000 : undefined,
        created: sub.created * 1000,
      };
    });

    return NextResponse.json({
      success: true,
      metrics: {
        totalSubscriptions: subscriptions.data.length,
        active: activeSubs.length,
        trialing: trialingSubs.length,
        canceled: canceledSubs.length,
        pastDue: pastDueSubs.length,
        mrr,
        totalRevenue: totalRevenue / 100,
        last30DaysRevenue: last30DaysRevenue / 100,
        growth,
        trialEnding: trialEnding.length,
      },
      subscriptions: subscriptionList,
      recentTransactions,
    });
  } catch (error: any) {
    console.error('[Stripe API] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Stripe data' },
      { status: 500 },
    );
  }
}
