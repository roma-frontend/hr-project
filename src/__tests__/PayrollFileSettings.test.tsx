/**
 * The salary bank-file settings screen.
 *
 * Two behaviours are worth a rendered test rather than a unit test, because both
 * are about what the accountant *sees* before money moves:
 *
 * 1. **The preview reads a real payroll run.** With hard-coded sample employees
 *    it proved the column order and hid the fact that rows without a bank account
 *    are withheld from the file — so the screen looked right and the export paid
 *    fewer people. The first test asserts the real names appear, the unroutable
 *    row does not, and the screen says a row was held back.
 *
 * 2. **The template import is a suggestion, not an assertion.** Uploading the
 *    bank's file fills in a mapping the accountant confirms, and a template that
 *    names neither the account nor the amount cannot be applied at all, because
 *    saving it would leave every export unable to say where the money goes.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * `t` resolved against the real `en` locale.
 *
 * A mock that only ever echoes the inline default cannot see whether the key
 * exists, which is exactly what an error message like `importUnsupported`
 * depends on — it would render the generic "Could not read that file" and the
 * test would agree with it.
 */
const mockLocaleCache: Record<string, unknown> = {};

function mockResolve(
  key: string,
  fallback?: string | Record<string, unknown>,
  options?: Record<string, unknown>,
): string {
  const namespace = key.split('.')[0];
  if (namespace && !(namespace in mockLocaleCache)) {
    try {
      mockLocaleCache[namespace] = JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), 'public', 'locales', 'en', `${namespace}.json`),
          'utf8',
        ),
      );
    } catch {
      mockLocaleCache[namespace] = {};
    }
  }
  // The files repeat their namespace inside themselves (`payroll.json` holds a
  // `payroll` object), so the whole key is walked from the file root.
  let node: unknown = mockLocaleCache[namespace ?? ''];
  for (const part of key.split('.')) {
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
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
  // The second argument doubles as the interpolation bag when it is an object —
  // `t(key, { defaultValue, count })` is a call the screen relies on.
  const vars: Record<string, unknown> = {
    ...(fallback && typeof fallback === 'object' ? (fallback as Record<string, unknown>) : {}),
    ...(options ?? {}),
  };
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return result;
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockResolve, i18n: { language: 'en' } }),
}));

let queryResults: Record<string, unknown> = {};
const mockMutation = jest.fn().mockResolvedValue(undefined);

jest.mock('convex/react', () => ({
  useQuery: (ref: { _name?: string }, args?: unknown) =>
    // The component passes 'skip' when the query must not fire; an unmocked
    // query would otherwise look like it returned data.
    args === 'skip' ? undefined : queryResults[ref?._name ?? ''],
  useMutation: () => mockMutation,
}));

jest.mock('@/convex/_generated/api', () => ({
  api: {
    payrollFile: {
      getPayrollFileLayout: { _name: 'getPayrollFileLayout' },
      savePayrollFileLayout: { _name: 'savePayrollFileLayout' },
      resetPayrollFileLayout: { _name: 'resetPayrollFileLayout' },
    },
    payroll: {
      queries: {
        getPayrollRuns: { _name: 'getPayrollRuns' },
        getPayrollRunById: { _name: 'getPayrollRunById' },
      },
    },
  },
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', role: 'admin', organizationId: 'org-1', name: 'Admin' },
  }),
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
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

import { PayrollFileSettings } from '@/components/settings/PayrollFileSettings';

function runRecord(overrides: Record<string, unknown>) {
  return {
    userId: 'u1',
    period: '2026-08',
    netSalary: 300000,
    netPayout: null,
    status: 'approved',
    currency: 'AMD',
    user: { name: 'Real Person' },
    bankAccountNumber: '15700123456789012345',
    bankName: 'Ameriabank',
    ...overrides,
  };
}

const RUNS = [
  { _id: 'run-1', period: '2026-08', status: 'approved', recordCount: 2, currency: 'AMD' },
];

/** What exactly the preview panel would write to disk. */
function previewText(): string {
  const pre = document.querySelector('pre');
  return pre?.textContent ?? '';
}

function UploadFile(name: string, content: string) {
  return { name, text: async () => content } as unknown as File;
}

async function uploadTemplate(name: string, content: string) {
  const input = screen.getByTestId('payroll-file-template-input');
  fireEvent.change(input, { target: { files: [UploadFile(name, content)] } });
  await waitFor(() => expect(input).toBeTruthy());
}

beforeEach(() => {
  queryResults = {};
  mockMutation.mockClear();
});

describe('preview over a real payroll run', () => {
  it('renders the run’s own rows and says which ones were held back', async () => {
    queryResults = {
      getPayrollFileLayout: null,
      getPayrollRuns: RUNS,
      getPayrollRunById: {
        _id: 'run-1',
        period: '2026-08',
        status: 'approved',
        records: [
          runRecord({}),
          // No bank account yet: an unroutable row that must not reach the file.
          runRecord({
            userId: 'u2',
            netSalary: 200000,
            user: { name: 'Unroutable Person' },
            bankAccountNumber: null,
            bankName: null,
          }),
        ],
      },
    };

    render(<PayrollFileSettings />);

    await waitFor(() => expect(previewText()).toContain('Real Person'));
    const content = previewText();
    expect(content).toContain('15700123456789012345');
    expect(content).toContain('300000');
    // The point of the change: the withheld row is absent from the file and the
    // screen says so, instead of the file just being shorter than the payroll.
    expect(content).not.toContain('Unroutable Person');
    expect(screen.getByText(/1 rows are held back/)).toBeTruthy();
    // The total is the payable sum, not the run's gross.
    expect(screen.getByText(/AMD\s?300,000/)).toBeTruthy();
  });

  it('falls back to labelled sample rows when there is no payroll run yet', async () => {
    queryResults = { getPayrollFileLayout: null, getPayrollRuns: [] };

    render(<PayrollFileSettings />);

    await waitFor(() => expect(previewText()).toContain('Ani Petrosyan'));
    expect(previewText()).toContain('Davit Sargsyan');
    // The accountant must not mistake the samples for their own data.
    expect(screen.getByText(/there is no payroll run to read yet/)).toBeTruthy();
  });

  it('does not read a run when the organisation has none', () => {
    queryResults = { getPayrollFileLayout: null, getPayrollRuns: [] };

    render(<PayrollFileSettings />);

    expect(screen.getByText('Sample rows (no payroll run yet)')).toBeTruthy();
  });

  it('distinguishes a run with nothing payable from an empty layout', async () => {
    queryResults = {
      getPayrollFileLayout: null,
      getPayrollRuns: [{ _id: 'run-1', period: '2026-08', status: 'draft', recordCount: 1 }],
      getPayrollRunById: {
        _id: 'run-1',
        period: '2026-08',
        status: 'draft',
        records: [runRecord({ bankAccountNumber: null, bankName: null })],
      },
    };

    render(<PayrollFileSettings />);

    // The columns are configured, so "no columns selected" would send the
    // accountant to the wrong control.
    expect(await screen.findByText(/No payable rows in this run/)).toBeTruthy();
    expect(screen.queryByText('No columns selected.')).toBeNull();
  });
});

describe('importing the bank’s template', () => {
  beforeEach(() => {
    queryResults = { getPayrollFileLayout: null, getPayrollRuns: [] };
  });

  it('reads the column order from an uploaded file and applies it on confirmation', async () => {
    render(<PayrollFileSettings />);

    await uploadTemplate(
      'ameriabank.csv',
      'Հաշվի համար;Անուն Ազգանուն;Գումար;Նշանակություն\n15700123456789012345;Ani;450000;Salary\n',
    );

    // The header names are shown back for confirmation, with the first value.
    expect(await screen.findByText('Հաշվի համար')).toBeTruthy();
    expect(screen.getByText('Գումար')).toBeTruthy();
    expect(screen.getByText('15700123456789012345')).toBeTruthy();
    expect(screen.getByText(/separator ;, 1 data rows, header line: Yes/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Apply to layout' }));

    const columns = screen.getAllByRole('listitem');
    expect(columns).toHaveLength(4);
    expect(columns[0]!.textContent).toContain('Account number');
    expect(columns[1]!.textContent).toContain('Beneficiary');
    expect(columns[2]!.textContent).toContain('Amount');
    expect(columns[3]!.textContent).toContain('Payment purpose');
    // Nothing is saved by the import itself — the accountant still reviews the
    // preview and presses Save.
    expect(mockMutation).not.toHaveBeenCalled();
  });

  it('lets the accountant correct a suggestion before applying it', async () => {
    render(<PayrollFileSettings />);

    // "Znachenie" is not in the vocabulary, so the value's shape guesses amount
    // and the account column has to be placed by hand.
    await uploadTemplate('bank.csv', 'Kod;Znachenie\nAni Petrosyan;450000\n');
    expect(await screen.findByText('Kod')).toBeTruthy();

    const selects = screen.getAllByRole('combobox', { name: 'Our column' });
    // Column 1 → account (was guessed as beneficiary from the sample name).
    fireEvent.change(selects[0]!, { target: { value: 'account' } });
    fireEvent.change(selects[1]!, { target: { value: 'amount' } });

    fireEvent.click(screen.getByRole('button', { name: 'Apply to layout' }));

    const columns = screen.getAllByRole('listitem');
    expect(columns.map((c) => c.textContent)).toEqual([
      expect.stringContaining('Account number'),
      expect.stringContaining('Amount'),
    ]);
  });

  it('refuses a template that maps neither the account nor the amount', async () => {
    render(<PayrollFileSettings />);

    await uploadTemplate('names.csv', 'Name;Comment\nAni Petrosyan;hello\n');
    expect(await screen.findByText('Name')).toBeTruthy();

    // "Comment" maps to the payment purpose, so the file would name who to pay
    // and how much — except it says neither where nor how much.
    const apply = screen.getByRole('button', { name: 'Apply to layout' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    expect(
      screen.getByText(/The template must map these columns: Account number, Amount/),
    ).toBeTruthy();
  });

  it('explains what to do with an Excel template instead of showing mojibake', async () => {
    render(<PayrollFileSettings />);

    await uploadTemplate('template.xlsx', 'garbage');
    expect(
      await screen.findByText(/That file is not a CSV\. Open the bank’s template, save it as CSV/),
    ).toBeTruthy();
    // No mapping table for a file that was never read.
    expect(screen.queryByRole('button', { name: 'Apply to layout' })).toBeNull();
  });

  it('reports a CSV with nothing usable in it', async () => {
    render(<PayrollFileSettings />);

    await uploadTemplate('empty.csv', '   \n\n');
    expect(await screen.findByText(/No columns were found in that file/)).toBeTruthy();
  });
});
