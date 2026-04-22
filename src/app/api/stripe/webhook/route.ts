import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { resolvePlanFromPriceId } from '@/lib/stripe-config';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2026-02-25.clover' });
}

// Safe Resend initialization
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const resend = getResend();

// ── Processed event IDs cache (in-memory deduplication) ──────────────────────
const processedEvents = new Map<string, number>();
const EVENT_CACHE_TTL = 24 * 60 * 60 * 1000;

function isEventProcessed(eventId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of processedEvents.entries()) {
    if (now - ts > EVENT_CACHE_TTL) processedEvents.delete(id);
  }
  return processedEvents.has(eventId);
}

function markEventProcessed(eventId: string) {
  processedEvents.set(eventId, Date.now());
}

// ── Send notification email to manager ────────────────────────────────────────
async function notifyManager({
  email,
  plan,
  subscriptionId,
  trialEnd,
}: {
  email: string;
  plan: string;
  subscriptionId: string;
  trialEnd?: number;
}) {
  if (!resend) return; // Resend not configured

  const managerEmail = process.env.MANAGER_EMAIL;
  if (!managerEmail) return;

  const planLabels: Record<string, string> = {
    starter: 'Starter ($29/mo)',
    professional: 'Professional ($79/mo)',
    enterprise: 'Enterprise ($199/mo)',
  };

  const trialEndStr = trialEnd
    ? new Date(trialEnd).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'notifications@yourdomain.com',
    to: managerEmail,
    subject: `🎉 New subscription: ${planLabels[plan] ?? plan} — ${email}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#1e293b;margin-bottom:8px;">New Subscription 🎉</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#64748b;">Customer</td><td style="padding:8px 0;font-weight:600;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Plan</td><td style="padding:8px 0;font-weight:600;">${planLabels[plan] ?? plan}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Trial ends</td><td style="padding:8px 0;">${trialEndStr}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Subscription</td><td style="padding:8px 0;font-family:monospace;font-size:12px;">${subscriptionId}</td></tr>
      </table>
    </div>`,
  });
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    console.warn('[Stripe Webhook] Not configured, skipping');
    return NextResponse.json({ received: true, skipped: true });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  if (!webhookSecret) {
    console.warn('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ received: true, skipped: true });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature failed:', err.message);
    Sentry.captureException(err, { tags: { stripe: 'webhook_signature' } });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (isEventProcessed(event.id)) {
    console.log('[Stripe Webhook] ⏭️ Duplicate skipped:', event.id);
    return NextResponse.json({ received: true, dedup: true });
  }
  markEventProcessed(event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[Stripe] ✅ checkout.session.completed:', session.id);

        if (session.mode === 'subscription' && session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] });
          const priceId = sub.items.data[0]?.price?.id ?? '';
          const plan = (session.metadata?.plan as string) ?? resolvePlanFromPriceId(priceId);

          if (!plan) {
            console.error('[Stripe] ❌ Unknown plan:', priceId);
            Sentry.captureException(new Error(`Unknown plan: ${priceId}`), {
              tags: { stripe: 'unknown_plan' },
              extra: { sessionId: session.id, priceId },
            });
            break;
          }

          const supabase = createServiceClient();
          const { error } = await supabase.from('subscriptions').upsert({
            stripe_customerid: typeof sub.customer === 'string' ? sub.customer : (sub.customer as any).id,
            stripe_subscriptionid: sub.id,
            stripe_sessionid: session.id,
            plan: plan as 'starter' | 'professional' | 'enterprise',
            status: sub.status as "active" | "trialing" | "past_due" | "canceled" | "incomplete",
            email: session.customer_email ?? undefined,
            current_period_start: ((sub as any).current_period_start ?? 0) * 1000,
            current_period_end: ((sub as any).current_period_end ?? 0) * 1000,
            cancel_at_period_end: sub.cancel_at_period_end,
            trial_end: sub.trial_end ? (sub.trial_end as number) * 1000 : undefined,
          }, { onConflict: 'stripe_subscriptionid' });

          if (error) {
            console.error('[Stripe] Failed to save subscription:', error);
          } else {
            console.log('[Stripe] ✅ Subscription saved:', sub.id, plan);
          }

          const customerEmail = session.customer_email ?? (session.customer_details as any)?.email;
          if (customerEmail) {
            await notifyManager({
              email: customerEmail,
              plan,
              subscriptionId: sub.id,
              trialEnd: sub.trial_end ? (sub.trial_end as number) * 1000 : undefined,
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        console.log('[Stripe] 🔄 subscription.updated:', sub.id);
        const supabase = createServiceClient();
        await supabase
          .from('subscriptions')
          .update({
            status: sub.status as "active" | "trialing" | "past_due" | "canceled" | "incomplete",
            cancel_at_period_end: sub.cancel_at_period_end,
            current_period_start: ((sub as any).current_period_start ?? 0) * 1000,
            current_period_end: ((sub as any).current_period_end ?? 0) * 1000,
          })
          .eq('stripe_subscriptionid', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        console.log('[Stripe] ❌ subscription.deleted:', sub.id);
        const supabase = createServiceClient();
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            cancel_at_period_end: false,
          })
          .eq('stripe_subscriptionid', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId =
          typeof (invoice as any).subscription === 'string'
            ? (invoice as any).subscription
            : (invoice as any).subscription?.id;
        console.log('[Stripe] ⚠️ invoice.payment_failed:', invoice.id);
        if (subId) {
          const supabase = createServiceClient();
          await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              cancel_at_period_end: false,
            })
            .eq('stripe_subscriptionid', subId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId =
          typeof (invoice as any).subscription === 'string'
            ? (invoice as any).subscription
            : (invoice as any).subscription?.id;
        console.log('[Stripe] 💰 invoice.payment_succeeded:', invoice.id);
        if (subId) {
          const supabase = createServiceClient();
          await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              cancel_at_period_end: false,
              current_period_start: invoice.period_start
                ? (invoice.period_start as number) * 1000
                : undefined,
              current_period_end: invoice.period_end
                ? (invoice.period_end as number) * 1000
                : undefined,
            })
            .eq('stripe_subscriptionid', subId);
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        console.log('[Stripe] ⏳ trial_will_end:', sub.id);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as any;
        console.log('[Stripe] 💸 charge.refunded:', charge.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.log('[Stripe] ❌ payment_intent.payment_failed:', intent.id);
        Sentry.captureException(new Error(`Payment intent failed: ${intent.id}`), {
          tags: { stripe: 'payment_intent_failed' },
          extra: { intentId: intent.id, amount: intent.amount },
        });
        break;
      }

      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`[Stripe] ${event.type}:`, sub.id);
        const supabase = createServiceClient();
        await supabase
          .from('subscriptions')
          .update({
            status: event.type === 'customer.subscription.paused' ? 'canceled' : 'active',
            cancel_at_period_end: false,
          })
          .eq('stripe_subscriptionid', sub.id);
        break;
      }

      default:
        console.log('[Stripe Webhook] Unhandled:', event.type);
        break;
    }
  } catch (err: any) {
    console.error('[Stripe Webhook] Handler error:', err.message);
    Sentry.captureException(err, {
      tags: { stripe: 'webhook_handler' },
      extra: { eventType: event.type, eventId: event.id },
    });
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
