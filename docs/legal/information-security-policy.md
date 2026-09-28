# Information Security Policy (ISP) — Strata Platform

> **Scope:** Strata Platform, all employees, contractors, systems, databases, and third-party SaaS services.  
> **Standard:** SOC 2 Type II (Common Criteria CC1.1, CC1.4, CC5.1–CC5.3) & GDPR / Armenian Law on Personal Data Protection.  
> **Effective Date:** 2026-09-20  
> **Security Officer:** Lead Platform Engineer / Founder (`security@strata.am`)  
> **Review Cycle:** Annual (or upon major architectural change)

---

## 1. Purpose & Objectives

Strata processes mission-critical HR, attendance (including biometrics), payroll, and communication data for multi-tenant organizations. The objective of this policy is to:

1. Ensure the **confidentiality, integrity, and availability (CIA)** of tenant data.
2. Protect customer data from unauthorized access, accidental loss, disclosure, or corruption.
3. Establish clear accountability, mandatory controls, and operational disciplines.

---

## 2. Roles & Responsibilities

- **Security Officer (CISO / Security Lead):** Responsible for the design, implementation, and review of security policies, risk assessments, vendor reviews, incident response leadership, and SOC 2 audit coordination.
- **Engineers & Developers:** Must adhere to secure coding guidelines, participate in PR reviews per `.github/CODEOWNERS`, verify dependencies, and promptly remediate vulnerabilities.
- **All Personnel (Employees & Contractors):** Must follow Acceptable Use rules, complete annual security awareness training, use multi-factor authentication (MFA) everywhere, and report suspected incidents immediately.

---

## 3. Core Security Principles

### 3.1 Data Classification

1. **Public:** Marketing landing pages, documentation, public comparisons (`/compare`).
2. **Internal Business Data:** Platform metrics, aggregated performance data.
3. **Confidential Customer Data:** Employee records, compensation, leave balances, reviews, tickets.
4. **Restricted / Special Category:**
   - **Biometric face descriptors** (GDPR Art. 9; requires explicit consent, zero raw storage).
   - **Authentication credentials** (passwords, JWT secrets, SCIM tokens, API keys).
   - **Tax and Banking identifiers** (Armenian SSN, HVHH, IBAN/bank account numbers).

### 3.2 Access Control & Authentication

- **Least Privilege:** Access to production infrastructure (Vercel, Convex, Upstash, Stripe, AWS/Cloudflare) is granted on a strict need-to-know basis.
- **Mandatory MFA:** Mandatory 2FA/MFA on GitHub, Vercel, Convex, Google Workspace, and Sentry accounts.
- **Privileged Access Governance:** Superadmin access in Strata is monitored, audited, session-bounded, and reviewed quarterly.
- **No Production Data on Laptops:** Production databases must never be cloned to developer workstations. Testing uses mock generators or the deterministic seed script.

### 3.3 Cryptography & Secrets Management

- **Data in Transit:** TLS 1.3 / 1.2 enforced across all external and internal communications with HSTS.
- **Data at Rest:** All tenant databases, attachments, and backups are encrypted at rest using AES-256.
- **Credential Storage:** User passwords hashed with bcrypt (12 rounds). SCIM tokens and API keys stored exclusively as SHA-256 digests.
- **No Committed Secrets:** Secrets reside strictly in deployment environment variables (Vercel Project Settings and Convex Environment Variables). Pre-commit hooks and CI prevent commits with credentials.

### 3.4 Change Management & Code Quality

- All production code changes must follow the **Four-Eyes Principle**: at least one peer review and approvals via `.github/CODEOWNERS`.
- Automated CI pipeline must pass: strict linting, TypeScript type-check (`tsc --noEmit`), unit/integration test coverage threshold, and Playwright E2E suites.
- Direct pushes to `main` are restricted via GitHub branch protection.

### 3.5 Vendor & Third-Party Management

- All subprocessors must have a valid SOC 2 Type II or ISO 27001 certification and an executed Data Processing Agreement (DPA).
- Vendor risk is reviewed annually and documented in `docs/vendor-register.md`.

---

## 4. Incident Response & 72-Hour Commitment

- Any breach or suspected compromise of customer personal data triggers the Incident Response Plan (`docs/incident-response.md`).
- Strata commits to notifying affected tenant administrators within **72 hours** of confirming a breach, providing impact assessment, affected records count, and remedial actions taken.

---

## 5. Security Training & Policy Acknowledgment

- All personnel must undergo security awareness training upon onboarding and annually thereafter (covering phishing, credential hygiene, social engineering, and data privacy).
- Failure to comply with this policy may result in disciplinary action up to termination of contract.
