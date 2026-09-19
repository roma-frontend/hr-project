/**
 * Tests for convex/lib/emailMessage.ts — where an email goes and what it says.
 *
 * The send itself is one HTTP call to Resend. The *decisions* around it are where
 * the damage is, and they are all here:
 *
 *   - a placeholder API key must count as "not configured", or a copied
 *     `.env.example` produces 401s that look like a provider outage;
 *   - while the sending domain is unverified, Resend delivers only to the account
 *     owner, so the message has to be redirected and marked — and the redirect
 *     has to be visible, not silent, or a workflow that emails a new hire looks
 *     delivered when it went to an administrator;
 *   - a body interpolating a person's name is data, not markup.
 */
import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_FROM,
  VERIFIED_FROM,
  buildEmailContent,
  isValidEmailAddress,
  markRedirectedSubject,
  normalizeSubject,
  resolveEmailRouting,
  type EmailEnv,
} from '../../convex/lib/emailMessage';

const KEY = 're_test_1234567890';

/** A deployment with everything configured and the domain verified. */
const verifiedEnv: EmailEnv = { apiKey: KEY, domainVerified: true };

/** The state most deployments start in: key set, domain not verified yet. */
const unverifiedEnv: EmailEnv = {
  apiKey: KEY,
  domainVerified: false,
  testEmail: 'owner@strata.work',
};

describe('isValidEmailAddress', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmailAddress('ada@example.com')).toBe(true);
    expect(isValidEmailAddress('first.last+tag@sub.example.co.uk')).toBe(true);
    expect(isValidEmailAddress('  padded@example.com  ')).toBe(true);
  });

  it('rejects the shapes that actually turn up in a config field', () => {
    expect(isValidEmailAddress('')).toBe(false);
    expect(isValidEmailAddress('nope')).toBe(false);
    expect(isValidEmailAddress('@example.com')).toBe(false);
    expect(isValidEmailAddress('ada@')).toBe(false);
    expect(isValidEmailAddress('ada@localhost')).toBe(false);
    expect(isValidEmailAddress('two words@example.com')).toBe(false);
    expect(isValidEmailAddress('a@b@c.com')).toBe(false);
  });
});

describe('resolveEmailRouting', () => {
  it('sends to the real recipient when the domain is verified', () => {
    const routing = resolveEmailRouting('ada@example.com', verifiedEnv);
    expect(routing.configured).toBe(true);
    expect(routing.to).toBe('ada@example.com');
    expect(routing.intendedTo).toBe('ada@example.com');
    expect(routing.redirected).toBe(false);
    expect(routing.from).toBe(VERIFIED_FROM);
  });

  it('treats a missing key as unconfigured instead of attempting a send', () => {
    const routing = resolveEmailRouting('ada@example.com', {});
    expect(routing.configured).toBe(false);
    expect(routing.problem).toBe('no_api_key');
  });

  it('treats the .env.example placeholder as unconfigured', () => {
    // The forgot-password route guards against this exact string; a copied
    // example file must send nothing rather than fail at Resend with a 401 that
    // reads like an outage.
    const routing = resolveEmailRouting('ada@example.com', {
      apiKey: 're_your_api_key_here',
      domainVerified: true,
    });
    expect(routing.configured).toBe(false);
    expect(routing.problem).toBe('no_api_key');
  });

  it('reports a missing recipient rather than sending to nobody', () => {
    expect(resolveEmailRouting('', verifiedEnv).problem).toBe('no_recipient');
    expect(resolveEmailRouting('   ', verifiedEnv).problem).toBe('no_recipient');
  });

  it('rejects a malformed recipient instead of letting Resend do it', () => {
    const routing = resolveEmailRouting('not-an-address', verifiedEnv);
    expect(routing.configured).toBe(false);
    expect(routing.problem).toBe('invalid_recipient');
  });

  it('redirects to the fallback inbox while the domain is unverified', () => {
    const routing = resolveEmailRouting('ada@example.com', unverifiedEnv);
    expect(routing.configured).toBe(true);
    expect(routing.redirected).toBe(true);
    expect(routing.to).toBe('owner@strata.work');
    // The intended recipient is preserved: the delivery row has to show who the
    // message was meant for, otherwise the redirect is untraceable.
    expect(routing.intendedTo).toBe('ada@example.com');
    expect(routing.from).toBe(DEFAULT_FROM);
    expect(routing.domainVerified).toBe(false);
  });

  it('holds the message when there is no fallback to redirect to', () => {
    // Unverified domain + no test mailbox = nowhere legitimate to send. Refusing
    // is the only honest answer; silently dropping it with a success status is
    // not.
    const routing = resolveEmailRouting('ada@example.com', { apiKey: KEY });
    expect(routing.configured).toBe(false);
    expect(routing.problem).toBe('no_fallback');
  });

  it('ignores a fallback address that is not usable', () => {
    const routing = resolveEmailRouting('ada@example.com', {
      apiKey: KEY,
      testEmail: 'not-an-address',
    });
    expect(routing.problem).toBe('no_fallback');
  });

  it('uses RESEND_FROM_EMAIL when the deployment sets one', () => {
    const routing = resolveEmailRouting('ada@example.com', {
      ...verifiedEnv,
      fromEmail: 'HR <hr@acme.am>',
    });
    expect(routing.from).toBe('HR <hr@acme.am>');
  });
});

describe('markRedirectedSubject', () => {
  it('marks the real recipient so the redirect is obvious in the inbox', () => {
    expect(markRedirectedSubject('Leave approved', 'ada@example.com')).toBe(
      '[For ada@example.com] Leave approved',
    );
  });
});

describe('buildEmailContent', () => {
  it('escapes HTML in the body and the recipient name', () => {
    const content = buildEmailContent({
      subject: 'Hello',
      body: '<script>alert(1)</script>',
      recipientName: 'Ada <Lovelace>',
    });
    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&lt;script&gt;');
    expect(content.html).toContain('Ada &lt;Lovelace&gt;');
  });

  it('splits blank-line-separated blocks into paragraphs', () => {
    const content = buildEmailContent({
      subject: 'Hi',
      body: 'First paragraph.\n\nSecond paragraph.',
    });
    expect(content.html).toContain('First paragraph.');
    expect(content.html).toContain('Second paragraph.');
    expect(content.text).toContain('First paragraph.');
  });

  it('keeps single newlines as line breaks inside a paragraph', () => {
    const content = buildEmailContent({
      subject: 'Hi',
      body: 'line one\nline two',
    });
    expect(content.html).toContain('line one<br>line two');
    expect(content.text).toContain('line one\nline two');
  });

  it('refuses a non-http action link instead of rendering it', () => {
    const content = buildEmailContent({
      subject: 'Hi',
      body: 'body',
      actionUrl: 'javascript:alert(1)',
      actionLabel: 'Click me',
    });
    expect(content.html).not.toContain('javascript:');
    expect(content.html).not.toContain('Click me');
  });

  it('renders an https action link as a button', () => {
    const content = buildEmailContent({
      subject: 'Hi',
      body: 'body',
      actionUrl: 'https://app.example.com/leaves',
      actionLabel: 'Open request',
    });
    expect(content.html).toContain('href="https://app.example.com/leaves"');
    expect(content.html).toContain('Open request');
    expect(content.text).toContain('https://app.example.com/leaves');
  });

  it('always produces a plain-text alternative', () => {
    const content = buildEmailContent({ subject: 'Hi', body: 'body', organizationName: 'Acme' });
    expect(content.text).toContain('Hi');
    expect(content.text).toContain('Acme');
    // Every message carries the product footer, so an unexpected email is
    // attributable.
    expect(content.html).toContain('Sent via Strata');
  });

  it('falls back to placeholders rather than sending an empty message', () => {
    const content = buildEmailContent({ subject: '   ', body: '\n\n  \n' });
    expect(content.subject).toBe('(no subject)');
    expect(content.text).toContain('(no message)');
  });

  it('includes the greeting only when a name is known', () => {
    expect(buildEmailContent({ subject: 's', body: 'b' }).html).not.toContain('Hi ');
    expect(buildEmailContent({ subject: 's', body: 'b', recipientName: 'Ada' }).html).toContain(
      'Hi Ada,',
    );
  });

  it('shows the organisation as the sender identity', () => {
    const content = buildEmailContent({ subject: 's', body: 'b', organizationName: 'Acme HR' });
    expect(content.html).toContain('Acme HR');
    expect(content.text.startsWith('Acme HR')).toBe(true);
  });
});

describe('normalizeSubject', () => {
  it('collapses newlines, which would otherwise be header injection', () => {
    expect(normalizeSubject('Leave\n Bcc: someone@example.com')).toBe(
      'Leave Bcc: someone@example.com',
    );
  });

  it('trims and bounds the length', () => {
    expect(normalizeSubject('  padded  ')).toBe('padded');
    const long = normalizeSubject('x'.repeat(400));
    expect(long.length).toBe(200);
    expect(long.endsWith('...')).toBe(true);
  });
});
