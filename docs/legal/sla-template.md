# Service Level Agreement — template

> **Status: template, not a signed instrument.** The numbers below are the values the
> public page at `/sla` publishes — if you change one, change both. Confirm the
> availability target and credit schedule with the business before sending this to a
> customer: they are commercial commitments, not engineering defaults.

**Applies to:** `{{plan — Enterprise}}` subscriptions under a signed order form
**Effective:** `{{date}}` · **Review:** annually

---

## 1. Definitions

- **Unavailable** — the Service's public application endpoints return errors for more than
  `{{5}}` consecutive minutes, measured from at least two external locations.
- **Monthly Uptime Percentage** — `(total minutes − excluded minutes − unavailable minutes) / (total minutes − excluded minutes) × 100`, per calendar month.
- **Excluded** — scheduled maintenance announced at least `{{72}}` hours in advance,
  emergency security maintenance, force majeure, and failures of the customer's own network
  or third-party services outside our control.

## 2. Commitments

| Commitment        | Standard                                                                             |
| ----------------- | ------------------------------------------------------------------------------------ |
| Availability      | `{{99.9}}%` per calendar month                                                       |
| Support hours     | `{{09:00–18:00 Asia/Yerevan, Mon–Fri}}` for High and Normal; `{{24×7}}` for Critical |
| Critical response | `{{1 hour}}` — Service unavailable, or data at risk                                  |
| High response     | `{{4 business hours}}` — major function blocked, no workaround                       |
| Normal response   | `{{1 business day}}` — questions, configuration, minor issues                        |
| Service credits   | Per section 3                                                                        |

## 3. Service credits

| Monthly Uptime Percentage | Credit against next invoice |
| ------------------------- | --------------------------- |
| `< 99.9%`                 | `{{5}}%` of monthly fee     |
| `< 99.0%`                 | `{{10}}%`                   |
| `< 98.0%`                 | `{{25}}%`                   |

3.1 The customer must claim credits within `{{30}}` days of the affected month, with the
incident references.

3.2 Credits are the sole remedy for missed availability commitments, other than termination
for repeated failure as set out in the subscription agreement.

## 4. Reporting and status

4.1 Incidents are raised in the support tickets module so each carries a reference, or via
`/contact` for security matters. Our responsible-disclosure route is on `/security`.

4.2 The Processor informs affected customers of confirmed incidents affecting their data
without undue delay, alongside the breach notification in the DPA.

## 5. Reporting measured uptime

We do not publish a historical uptime figure until an external monitor feeds one. When that
exists, the number and its source belong on `/sla` next to the target above.
