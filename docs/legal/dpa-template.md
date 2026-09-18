# Data Processing Agreement — template

> **Status: template, not a signed instrument.** Review with counsel before it is
> sent to a customer. Placeholders are in `{{double braces}}`. The public summary
> at `/dpa` describes this document and must be updated whenever the clauses
> below change.

**Between:** `{{Customer legal name}}` ("Controller") and `{{Our legal entity}}` ("Processor")
**Effective:** `{{date}}` · **Term:** the term of the underlying subscription agreement

---

## 1. Scope and roles

1.1 The Processor processes Personal Data on behalf of the Controller to provide the
Strata HR platform (the "Service").

1.2 Processing is limited to: employee and candidate records, attendance and leave data,
payroll inputs, documents and signatures, and communications sent through the Service.

1.3 Data subjects: the Controller's employees, candidates, contractors and drivers.

1.4 The Controller determines the purposes and means of processing. The Processor acts
only on documented instructions, including those given through the Service's settings.

## 2. Processor obligations

2.1 **Instructions.** Process Personal Data only on documented instructions. The Processor
will inform the Controller if an instruction infringes applicable data protection law.

2.2 **Confidentiality.** Personnel authorised to process Personal Data are bound by
confidentiality obligations that survive termination of their engagement.

2.3 **Assistance.** Provide reasonable assistance with data subject requests, impact
assessments and prior consultations with supervisory authorities.

2.4 **Breach notification.** Notify the Controller without undue delay, and no later than
`{{72}}` hours, after becoming aware of a Personal Data Breach, with the information the
Controller needs to meet its own reporting duty.

2.5 **Deletion or return.** On termination, delete or return Personal Data at the
Controller's choice, except where retention is required by law. Backups are purged on their
normal rotation, not later than `{{90}}` days.

## 3. Security measures (Annex II)

Technical and organisational measures, as implemented in the Service and described on the
`/security` page:

- encryption in transit (TLS) and at rest;
- role-based access control with the five platform roles, enforced server-side;
- audit logging of privileged actions, including actor and IP;
- access reviews and least-privilege provisioning;
- SSO (SAML 2.0 / OIDC) and SCIM de-provisioning;
- documented incident response and backup restoration testing.

## 4. Subprocessors

4.1 The Controller grants general authorisation for the subprocessors listed at
`/subprocessors`.

4.2 The Processor gives at least `{{30}}` days' notice before adding or replacing a
subprocessor, and the Controller may object in writing in that window. If no resolution is
reached, the Controller may terminate the affected part of the Service.

4.3 Subprocessors are bound by written terms no less protective than this Agreement.

## 5. International transfers

5.1 Primary application compute is pinned to the EU (`fra1`, Frankfurt).

5.2 Where a subprocessor transfers Personal Data outside the EEA, the transfer relies on
Standard Contractual Clauses (and the UK Addendum where applicable), annexed as Annex III.

## 6. Audit

6.1 The Processor makes available the information reasonably necessary to demonstrate
compliance, and allows audits or inspections at reasonable intervals, at the Controller's
cost, subject to confidentiality and a `{{30}}`-day notice.

## 7. Liability

7.1 Liability under this Agreement is subject to the limitations in the subscription
agreement, except where applicable law provides otherwise.

---

**Annexes**

- **Annex I** — categories of data subjects and Personal Data, processing purposes and duration.
- **Annex II** — technical and organisational measures (section 3 above).
- **Annex III** — Standard Contractual Clauses and UK Addendum, as applicable.
