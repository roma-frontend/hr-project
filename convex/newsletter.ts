// @ts-nocheck - Convex API types cause TS2589 in complex module graphs
import {
  mutation,
  action,
  internalAction,
  internalQuery,
  internalMutation,
} from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { WeeklyDigestEmail } from '../src/emails/WeeklyDigestEmail';

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.includes('your_api_key')) return null;
  return new Resend(key);
}

export const subscribe = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    language: v.union(v.literal('en'), v.literal('ru'), v.literal('hy'), v.literal('deu')),
    topics: v.optional(
      v.array(
        v.union(
          v.literal('hr-tips'),
          v.literal('leadership'),
          v.literal('wellness'),
          v.literal('tech'),
        ),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('newsletterSubscribers')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (existing) {
      if (existing.unsubscribed) {
        await ctx.db.patch(existing._id, { unsubscribed: false, subscribedAt: Date.now() });
        return { success: true, alreadySubscribed: false };
      }
      return { success: true, alreadySubscribed: true };
    }

    const unsubscribeToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

    await ctx.db.insert('newsletterSubscribers', {
      email: args.email,
      name: args.name,
      language: args.language,
      topics: args.topics,
      subscribedAt: Date.now(),
      unsubscribed: false,
      unsubscribeToken,
    });

    return { success: true, alreadySubscribed: false };
  },
});

export const unsubscribe = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const subscriber = await ctx.db
      .query('newsletterSubscribers')
      .withIndex('by_token', (q) => q.eq('unsubscribeToken', args.token))
      .first();

    if (!subscriber) return { success: false };
    await ctx.db.patch(subscriber._id, { unsubscribed: true });
    return { success: true };
  },
});

export const getActiveSubscribers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('newsletterSubscribers')
      .withIndex('by_active', (q) => q.eq('unsubscribed', false))
      .collect();
  },
});

export const generateWeeklyContent = internalAction({
  args: {},
  handler: async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

    const prompt = `Generate a professional HR weekly newsletter in JSON format. Include:
- subject: catchy email subject line
- greeting: warm opening paragraph
- tips: array of 3 objects with {title, body, emoji} - practical HR tips
- trends: array of 2 objects with {title, body} - current HR industry trends
- quote: object with {text, author} - inspirational leadership quote
- promo: object with {title, body, cta, link} - call to action for HR Office platform

Keep content professional, actionable, and concise. Return ONLY valid JSON.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'HR Office',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: [
          { role: 'system', content: 'You are an HR content expert. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse AI response as JSON');
    return JSON.parse(jsonMatch[0]);
  },
});

export const sendWeeklyDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    const resend = getResendClient();
    if (!resend) {
      console.log('Resend not configured, skipping weekly newsletter');
      return;
    }

    const subscribers = await ctx.runQuery(internal.newsletter.getActiveSubscribers, {});
    if (subscribers.length === 0) {
      console.log('No active subscribers, skipping newsletter');
      return;
    }

    const content = await ctx.runAction(internal.newsletter.generateWeeklyContent, {});
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hr-project-sigma.vercel.app';

    // Send in batches of 100
    for (let i = 0; i < subscribers.length; i += 100) {
      const batch = subscribers.slice(i, i + 100);
      const emails = batch.map((sub) => {
        const html = render(
          WeeklyDigestEmail({
            name: sub.name || 'HR Professional',
            content,
            unsubscribeUrl: `${appUrl}/api/newsletter/unsubscribe?token=${sub.unsubscribeToken}`,
          }),
        );
        return {
          from: 'HR Office <onboarding@resend.dev>',
          to: sub.email,
          subject: content.subject,
          html,
        };
      });

      try {
        await resend.batch.send(emails);
      } catch (error) {
        console.error('Failed to send newsletter batch:', error);
      }
    }

    // Update lastSentAt for all subscribers
    for (const sub of subscribers) {
      await ctx.runMutation(internal.newsletter.updateLastSent, { id: sub._id });
    }

    console.log(`Weekly newsletter sent to ${subscribers.length} subscribers`);
  },
});

export const updateLastSent = internalMutation({
  args: { id: v.id('newsletterSubscribers') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastSentAt: Date.now() });
  },
});

export const sendTestEmail = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const resend = getResendClient();
    if (!resend) throw new Error('Resend not configured');

    const content = await ctx.runAction(internal.newsletter.generateWeeklyContent, {});
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hr-project-sigma.vercel.app';

    const html = render(
      WeeklyDigestEmail({
        name: 'Test User',
        content,
        unsubscribeUrl: `${appUrl}/api/newsletter/unsubscribe?token=test`,
      }),
    );

    await resend.emails.send({
      from: 'HR Office <onboarding@resend.dev>',
      to: args.email,
      subject: content.subject,
      html,
    });

    return { success: true };
  },
});
