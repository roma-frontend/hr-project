/**
 * Copy that promises a team size or a price has to match the pricing model.
 *
 * The plans moved from flat pricing ($29 / $79) to per-seat pricing with volume
 * tiers, and the caps moved with them (Starter 10 → 25, Pro 50/100 → 300). Every
 * hardcoded number in a translation went stale on its own schedule: "Up to 10
 * employees" on the plan picker, "Up to 50 employees" on the landing cards,
 * "$29/mo" in the superadmin subscription wizard.
 *
 * The UI now computes caps from `seatCap()` (src/lib/pricing.ts) instead of
 * reading them out of a translated string, and this test fails the moment a
 * number in the remaining copy disagrees with the model — so the next limit or
 * price change cannot silently leave a lie on the page.
 *
 * `public/locales/*\/auth.json` is deliberately out of the scan: nothing renders
 * its legacy quota keys any more (see the last test).
 */
import fs from 'fs';
import path from 'path';
import { seatCap } from '@/lib/pricing';

const LOCALES = ['en', 'ru', 'hy', 'de'] as const;

/** Namespaces whose plan copy the billing model owns. */
const MODEL_COPY_NAMESPACES = ['landing', 'admin', 'employees', 'modules'] as const;

/** "Up to <cap> employees" with a hardcoded number, in any supported language. */
const STALE_CAP_COPY =
  /(up to|bis zu|до|մինչև)\s+(10|50|100)\s+(employees|сотрудник\w*|աշխատակից\w*|mitarbeiter)/i;

/** The flat-plan prices the product no longer sells. */
const FLAT_PRICE = /\$\s?(29|79|199)\b/;

function localeJson(lng: string, ns: string): unknown {
  const file = path.join(process.cwd(), 'public', 'locales', lng, `${ns}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Every leaf string of a locale file, as `dotted.key` → value. */
function walk(value: unknown, prefix = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    walk(child, prefix ? `${prefix}.${key}` : key),
  );
}

function at(json: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, json);
}

function firstNumber(text: string): number | null {
  const match = text.replace(/,/g, '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

/** Every `.tsx` under a directory, recursively. */
function tsxSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxSources(full);
    return entry.name.endsWith('.tsx') ? [fs.readFileSync(full, 'utf8')] : [];
  });
}

describe('plan copy vs the pricing model', () => {
  it('spells out the caps the model actually enforces', () => {
    const starter = seatCap('starter');
    const pro = seatCap('pro');
    expect(starter).toBeGreaterThan(0);
    expect(pro).toBeGreaterThan(0);

    // Key paths whose text spells a cap out. When this fails, update the locale
    // file in all four languages — the number is meant to be the model's.
    const cappedCopy: Array<[string, number]> = [
      ['admin:superadmin.organizations.starterDesc', starter as number],
      ['admin:superadmin.organizations.professionalDesc', pro as number],
      ['employees:organization.planStarter', starter as number],
      ['employees:organization.planProfessional', pro as number],
      ['modules:plan.starter10Employees', starter as number],
      ['modules:plan.professional50Employees', pro as number],
    ];

    for (const lng of LOCALES) {
      for (const [ref, expected] of cappedCopy) {
        const [ns, key] = ref.split(':') as [string, string];
        const text = at(localeJson(lng, ns), key);
        expect(typeof text).toBe('string');
        expect(firstNumber(text as string)).toBe(expected);
      }
    }
  });

  it('parameterises the cap on the pricing cards instead of spelling it out', () => {
    for (const lng of LOCALES) {
      const template = at(localeJson(lng, 'landing'), 'pricing.seatCap');
      expect(typeof template).toBe('string');
      // The bullet takes the count as a placeholder. A literal number here is
      // exactly how "Up to 10 employees" went stale in the first place.
      expect(template as string).toContain('{{n}}');
      expect(template as string).not.toMatch(/\d/);
    }
  });

  it('leaves no stale cap or flat price in model-owned copy', () => {
    const offenders: string[] = [];
    for (const lng of LOCALES) {
      for (const ns of MODEL_COPY_NAMESPACES) {
        for (const [key, text] of walk(localeJson(lng, ns))) {
          if (STALE_CAP_COPY.test(text) || FLAT_PRICE.test(text)) {
            offenders.push(`${lng}/${ns}:${key} = ${text}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('drives every registration step from the model, not the legacy auth keys', () => {
    // The auth pages used to read `auth.plans.*.employees*` / `registerOrgPage.proTeam`
    // out of auth.json, whose values are still the flat-plan era ones. They now
    // call seatCap() — if a key comes back, the stale copy comes back with it.
    const dir = path.join(process.cwd(), 'src', 'app', '(auth)', 'register-org');
    const sources = tsxSources(dir);
    expect(sources.length).toBeGreaterThan(0);

    const joined = sources.join('\n');
    for (const legacyKey of [
      'auth.plans.starter.employees',
      'auth.plans.professional.employees50',
      'registerOrgPage.proTeam',
      'registerOrgPage.enterpriseTeam',
      'registerOrgPage.starterTeam',
    ]) {
      expect(joined).not.toContain(legacyKey);
    }
    expect(joined).toContain('seatCap(');
  });
});
