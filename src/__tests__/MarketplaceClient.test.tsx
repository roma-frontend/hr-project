/**
 * The marketplace connect dialog.
 *
 * It grew into a wall of text and seventeen flat checkboxes, which pushed the two
 * things the admin actually came for — the URL field and the Connect button — off
 * the bottom of the screen. Three properties keep that from coming back:
 *
 *   1. the description states the signing and retry rule **once** (it had the same
 *      sentence twice in all four languages, which alone was four lines of dialog);
 *   2. the event list scrolls inside a fixed-height box instead of stretching the
 *      dialog past the viewport;
 *   3. the "no selection means every event type" rule is visible where the choice
 *      is made, so clearing the list does not read as a mistake.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, within } from '@testing-library/react';

jest.mock('react-i18next', () => {
  const load = (namespace: string) =>
    JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'public', 'locales', 'en', `${namespace}.json`),
        'utf8',
      ),
    );
  const cache: Record<string, unknown> = {};
  return {
    useTranslation: () => ({
      t: (
        key: string,
        fallback?: string | Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        const namespace = key.split('.')[0]!;
        cache[namespace] ??= load(namespace);
        let node: unknown = cache[namespace];
        for (const part of key.split('.')) {
          node =
            node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
        }
        let result: string;
        if (typeof node === 'string') {
          result = node;
        } else if (typeof fallback === 'string') {
          result = fallback;
        } else if (fallback && typeof fallback === 'object' && 'defaultValue' in fallback) {
          result = String(fallback.defaultValue ?? key);
        } else {
          return key;
        }
        const vars: Record<string, unknown> = {
          ...(fallback && typeof fallback === 'object' ? fallback : {}),
          ...(options ?? {}),
        };
        for (const [k, v] of Object.entries(vars)) {
          result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
        return result;
      },
    }),
  };
});

const mockEventTypes = ['leave.requested', 'leave.approved', 'employee.created', 'document.signed'];
const mockCreateEndpoint = jest.fn().mockResolvedValue('endpoint_1');

jest.mock('convex/react', () => ({
  useQuery: (ref: { _name?: string }) =>
    ref?._name === 'listEndpoints'
      ? []
      : ref?._name === 'listEventTypes'
        ? mockEventTypes
        : undefined,
  useMutation: () => mockCreateEndpoint,
}));

jest.mock('@/convex/_generated/api', () => ({
  api: {
    webhooks: {
      main: {
        listEndpoints: { _name: 'listEndpoints' },
        listEventTypes: { _name: 'listEventTypes' },
        createEndpoint: { _name: 'createEndpoint' },
      },
    },
  },
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthUser: () => ({ id: 'u1', role: 'admin', name: 'Admin' }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      checked={checked ?? false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

import MarketplaceClient from '@/components/marketplace/MarketplaceClient';
import { MARKETPLACE_APPS } from '@/lib/marketplace';

/**
 * How many of Slack's catalog defaults this deployment can actually deliver.
 *
 * Derived rather than hard-coded: the interesting number is the *intersection*,
 * and a test that pins a literal would fail the day the catalog gains an event
 * type for a legitimate reason.
 */
const slackDefaults = (
  MARKETPLACE_APPS.find((app) => app.id === 'slack')!.setup as { defaultEvents: string[] }
).defaultEvents;
const expectedSelected = slackDefaults.filter((event) => mockEventTypes.includes(event)).length;

/** Open the dialog for the Slack card — the app in the bug report. */
function openSlackDialog() {
  render(<MarketplaceClient />);
  const connect = screen.getAllByRole('button', { name: 'Connect' })[0]!;
  fireEvent.click(connect);
  return screen.getByRole('dialog');
}

beforeEach(() => {
  mockCreateEndpoint.mockClear();
});

describe('marketplace connect dialog', () => {
  it('states the signing rule once instead of repeating the sentence', () => {
    openSlackDialog();

    const description = screen.getByText(/Pick the events to send/).textContent ?? '';
    expect(description.match(/HMAC-SHA256/g)).toHaveLength(1);
    // The whole point of the rewrite: the paragraph a reader has to get through
    // before reaching the form.
    expect(description.length).toBeLessThan(250);
  });

  it('scrolls the event list rather than stretching the dialog past the viewport', () => {
    const dialog = openSlackDialog();

    const list = dialog.querySelector('.overflow-y-auto');
    expect(list).not.toBeNull();
    expect(list!.className).toContain('max-h-56');
    // Every event type is still in there — scrolling hides nothing.
    expect(within(list as HTMLElement).getAllByRole('checkbox')).toHaveLength(
      mockEventTypes.length,
    );
  });

  it('says that an empty selection means every event type', () => {
    const dialog = openSlackDialog();
    const panel = within(dialog);

    // Slack's defaults preselect some events, so the counter starts with numbers.
    expect(dialog.textContent).toContain(
      `${expectedSelected} of ${mockEventTypes.length} selected`,
    );

    fireEvent.click(panel.getByRole('button', { name: 'Clear' }));
    expect(dialog.textContent).toContain('All event types');

    fireEvent.click(panel.getByRole('button', { name: 'Select all' }));
    expect(dialog.textContent).toContain(
      `${mockEventTypes.length} of ${mockEventTypes.length} selected`,
    );
    for (const box of panel.getAllByRole('checkbox') as HTMLInputElement[]) {
      expect(box.checked).toBe(true);
    }
  });

  it('counts only the events the backend actually emits', () => {
    // Slack's catalog defaults name five event types; this deployment exposes
    // four. Counting the stale name gave "5 of 4 selected" and would have created
    // a subscription nothing can deliver.
    const dialog = openSlackDialog();

    expect(dialog.textContent).toContain(
      `${expectedSelected} of ${mockEventTypes.length} selected`,
    );
    // The stale default must not be counted, and must not leak into the total.
    expect(dialog.textContent).not.toContain(`${slackDefaults.length} of ${mockEventTypes.length}`);
  });

  it('sends the chosen events when the admin connects', async () => {
    const dialog = openSlackDialog();
    const panel = within(dialog);

    // By placeholder, not label: the Label mock has no `htmlFor`, and the field's
    // identity is what matters here, not the association.
    fireEvent.change(dialog.querySelector('#marketplace-url')!, {
      target: { value: 'https://hooks.slack.com/services/abc' },
    });
    fireEvent.click(panel.getByRole('button', { name: 'Clear' }));
    fireEvent.click(panel.getAllByRole('checkbox')[0]!);
    fireEvent.click(panel.getByRole('button', { name: 'Connect' }));

    expect(mockCreateEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Slack',
        url: 'https://hooks.slack.com/services/abc',
        events: [mockEventTypes[0]],
        enabled: true,
      }),
    );
  });
});
