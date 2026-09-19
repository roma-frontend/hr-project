'use client';

import {
  COMPETITORS,
  COMPARE_ROWS,
  ROWS_WITH_OUR_NOTE,
  competitorsByRegion,
  groupedRows,
  type CompetitorRegion,
  type CompetitorSlug,
  type Support,
  type RowCategory,
} from '@/lib/competitors';
import { useLandingTranslation } from '@/components/landing/useLandingTranslation';

/**
 * The comparison matrix. Server-rendered with `initialLanguage` (see
 * `useLandingTranslation`) so the first paint is already in the visitor's
 * language — no English flash on /compare.
 *
 * `only` narrows the vendor columns to a single competitor: the detail page
 * shows Strata vs one vendor, because a seven-column table on a head-to-head
 * page buries the answer the visitor came for.
 */
export default function CompareTable({
  initialLanguage = 'en',
  only,
  region,
}: {
  initialLanguage?: string;
  only?: CompetitorSlug;
  /** Limit columns to one market (the index renders a table per section). */
  region?: CompetitorRegion;
}) {
  const { t } = useLandingTranslation(initialLanguage);
  const columns = only
    ? COMPETITORS.filter((c) => c.slug === only)
    : region
      ? competitorsByRegion(region)
      : COMPETITORS;
  const groups = groupedRows();
  // Footnotes only for rows that survived into this render — the detail page
  // narrows columns, never rows, but computing it from the rendered set means
  // a future row filter can never print a caveat about a row nobody can see.
  const renderedKeys = new Set(groups.flatMap((group) => group.rows.map((row) => row.key)));
  const noted = ROWS_WITH_OUR_NOTE.filter((key) => renderedKeys.has(key));

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        background: 'var(--landing-card-bg)',
        border: '1px solid var(--landing-card-border)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[560px]">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--landing-card-border)' }}>
              <th
                scope="col"
                className="text-left font-semibold px-4 py-3.5 sticky left-0 z-10"
                style={{
                  color: 'var(--landing-text-secondary)',
                  background: 'var(--landing-card-bg)',
                  minWidth: '220px',
                }}
              >
                {t('compare.index.featureColumn')}
              </th>
              <th
                scope="col"
                className="text-center font-bold px-3 py-3.5"
                style={{ color: 'var(--brand-text)' }}
              >
                {t('compare.index.usColumn')}
              </th>
              {columns.map((c) => (
                <th
                  key={c.slug}
                  scope="col"
                  className="text-center font-semibold px-3 py-3.5"
                  style={{ color: 'var(--landing-text-secondary)' }}
                  title={c.name}
                >
                  <span className="block text-[11px] font-bold" style={{ color: c.color }}>
                    {c.monogram}
                  </span>
                  <span className="hidden md:block text-[11px] font-medium">{c.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <CategoryRows
                key={group.category}
                category={group.category}
                initialLanguage={initialLanguage}
                noted={noted}
                vendorColumns={columns.map((c) => c.slug)}
                rows={group.rows.map((row) => ({
                  key: row.key,
                  us: row.us,
                  vendors: columns.map((c) => row.vendors[c.slug]),
                }))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {noted.length > 0 ? (
        <div
          className="px-4 py-3 text-xs space-y-1.5"
          style={{
            borderTop: '1px solid var(--landing-card-border)',
            color: 'var(--landing-text-muted)',
          }}
        >
          {noted.map((key) => (
            <p key={key} className="leading-relaxed">
              <span className="font-semibold" style={{ color: 'var(--landing-text-secondary)' }}>
                *
              </span>{' '}
              {t(`compare.notes.${key}`)}
            </p>
          ))}
        </div>
      ) : null}

      <Legend initialLanguage={initialLanguage} />
    </div>
  );
}

function CategoryRows({
  category,
  initialLanguage,
  noted,
  vendorColumns,
  rows,
}: {
  category: RowCategory;
  initialLanguage: string;
  /** Row keys that carry a footnote under the matrix. */
  noted: readonly string[];
  vendorColumns: CompetitorSlug[];
  rows: { key: string; us: Support; vendors: Support[] }[];
}) {
  const { t } = useLandingTranslation(initialLanguage);

  return (
    <>
      <tr style={{ background: 'var(--landing-bg)' }}>
        <th
          scope="colgroup"
          colSpan={vendorColumns.length + 2}
          className="text-left text-xs font-bold uppercase tracking-wider px-4 py-2.5 sticky left-0"
          style={{ color: 'var(--landing-text-muted)', background: 'var(--landing-bg)' }}
        >
          {t(`compare.categories.${category}`)}
        </th>
      </tr>
      {rows.map((row) => (
        <tr key={row.key} style={{ borderBottom: '1px solid var(--landing-card-border)' }}>
          <th
            scope="row"
            className="text-left font-medium px-4 py-3 sticky left-0 z-10"
            style={{ color: 'var(--landing-text-primary)', background: 'var(--landing-card-bg)' }}
          >
            {t(`compare.rows.${row.key}`)}
          </th>
          <SupportCell
            support={row.us}
            emphasis
            initialLanguage={initialLanguage}
            note={noted.includes(row.key) ? t(`compare.notes.${row.key}`) : undefined}
          />
          {row.vendors.map((support, i) => (
            <SupportCell
              key={vendorColumns[i]}
              support={support}
              initialLanguage={initialLanguage}
            />
          ))}
        </tr>
      ))}
    </>
  );
}

function SupportCell({
  support,
  emphasis,
  note,
  initialLanguage,
}: {
  support: Support;
  emphasis?: boolean;
  /** Our own column only: the caveat that makes a qualified mark readable. */
  note?: string;
  initialLanguage: string;
}) {
  const { t } = useLandingTranslation(initialLanguage);
  const label = t(`compare.legend.${support}`);
  const color =
    support === 'yes' ? '#10b981' : support === 'partial' ? '#f59e0b' : 'var(--landing-text-muted)';

  return (
    <td
      className="text-center px-3 py-3"
      title={note ? `${label} — ${note}` : label}
      aria-label={note ? `${label}. ${note}` : label}
      style={emphasis ? { background: 'var(--brand-quiet)' } : undefined}
    >
      {support === 'yes' ? <CheckDot color={color} /> : null}
      {support === 'partial' ? <HalfDot color={color} /> : null}
      {support === 'no' ? <Dash color={color} /> : null}
      {note ? (
        <span aria-hidden className="align-super text-[9px] ml-0.5">
          *
        </span>
      ) : null}
    </td>
  );
}

function Legend({ initialLanguage }: { initialLanguage: string }) {
  const { t } = useLandingTranslation(initialLanguage);
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-xs"
      style={{
        borderTop: '1px solid var(--landing-card-border)',
        color: 'var(--landing-text-muted)',
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        <CheckDot color="#10b981" /> {t('compare.legend.yes')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <HalfDot color="#f59e0b" /> {t('compare.legend.partial')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Dash color="var(--landing-text-muted)" /> {t('compare.legend.no')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-3 h-3 rounded-sm"
          style={{ background: 'var(--brand-quiet)' }}
        />
        {t('compare.legend.us')}
      </span>
    </div>
  );
}

/* ── Inline icons (no icon library on marketing routes) ──────────────────── */

function CheckDot({ color }: { color: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="inline-block"
    >
      <circle cx="12" cy="12" r="9" fill={color} opacity="0.14" />
      <path
        d="M8 12.5l2.5 2.5L16 9.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HalfDot({ color }: { color: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="inline-block"
    >
      <circle cx="12" cy="12" r="9" fill={color} opacity="0.14" />
      <path d="M12 5a7 7 0 010 14z" fill={color} opacity="0.85" />
      <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

function Dash({ color }: { color: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="inline-block"
    >
      <path d="M8 12h8" stroke={color} strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** Row count for the "N capabilities checked" line — always in sync with data. */
export const COMPARE_ROW_COUNT = COMPARE_ROWS.length;
