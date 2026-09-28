# Joiner, Mover, Leaver (JML) Runbook

> **Scope:** Access provisioning and deprovisioning for Strata Platform internal staff and contractors across all cloud providers and development systems.  
> **Standard:** SOC 2 Type II (CC6.2, CC6.3).  
> **Target SLA:**
>
> - Joiners: Day 1 provisioning.
> - Movers: Role adjustment within 24 hours.
> - Leavers (Voluntary): Deprovisioning within **24 hours** of the final working hour.
> - Leavers (Involuntary / Hostile): Deprovisioning **immediately (within 1 hour)** prior to or during the termination meeting.

---

## 1. System Inventory for Internal Access

Internal staff may hold administrative or developer access across these stores:

1. **GitHub Organization:** (`roma-frontend/hr-project`) — repository access, branch permissions, settings.
2. **Convex Cloud Dashboard:** (`convex.dev`) — production and staging data access, environment variables, logs.
3. **Vercel Team Dashboard:** (`vercel.com`) — production deployments, domain settings, edge middleware, secrets.
4. **Stripe Dashboard:** (`dashboard.stripe.com`) — payments, subscription plans, customer financial records.
5. **Resend / Upstash / Cloudinary / LiveKit Dashboards:** Third-party developer consoles.
6. **Sentry Dashboard:** Application error logs (potential PII traces in exception reports).
7. **Strata Platform Instance:** `superadmin` role account in production.

---

## 2. Joiner Procedure (New Hire / Contractor)

1. **Pre-requisite:** Signed NDA, employment/contractor agreement, and acknowledgment of `docs/legal/information-security-policy.md`.
2. **Hardware & Identity:**
   - Configure corporate Google Workspace / email account with mandatory 2FA.
   - Enforce password manager usage (1Password / Bitwarden) with generated random master password.
3. **System Access Allocation (Role-based):**
   - **Frontend/Backend Developer:** GitHub (`Write` access), staging Convex deployment, Sentry.
   - **Lead / DevOps:** Vercel (Developer role), Convex Cloud (Production team member).
   - **Customer Support / Operations:** Support agent role within tenant, NO direct database access.
4. **Audit Entry:** Record date, authorized role, and approver in the internal Access Matrix.

---

## 3. Mover Procedure (Role Change / Department Transfer)

1. HR / Manager submits role modification ticket.
2. Security Officer conducts an access delta check:
   - Identify obsolete permissions (e.g. moving from Backend to Product Management removes Convex Cloud prod write access).
   - Revoke obsolete permissions within **24 hours**.
   - Grant new role-specific entitlements.
3. Record permission changes in the audit log.

---

## 4. Leaver Procedure (Offboarding & Deprovisioning Checklist)

The Security Officer or designated administrator must execute the following revocation sequence:

### Step 1: Immediate Identity & Code Access Revocation

- [ ] **GitHub:** Remove from GitHub Organization team; revoke any personal access tokens (PATs) or SSH deploy keys associated with the employee.
- [ ] **Google Workspace / SSO:** Suspend corporate email account, terminate all active browser sessions, reset password.

### Step 2: Cloud Infrastructure & Database Access Revocation

- [ ] **Convex Cloud:** Remove team member from the production team and personal dev deployments.
- [ ] **Vercel:** Remove user from the Vercel team dashboard.
- [ ] **Stripe & Payment Gateways:** Revoke team access on Stripe, Idram, and ArCa portals.
- [ ] **Supporting Subprocessors:** Remove account from Sentry, Resend, Cloudinary, LiveKit, Upstash.

### Step 3: Platform Superadmin & User Deactivation

- [ ] In Strata Platform: Set user `isActive = false`, set `role = 'employee'`, revoke all active sessions (`security:revokeAllSessionsForUser`).
- [ ] If temporary token was issued: Revoke token via `superadmin/accessTokens:revokeAccessToken`.

### Step 4: Verification & Sign-off

- [ ] Execute `npx tsx scripts/soc2-evidence.mjs` or export superadmins via `exportSuperadminsForAccessReview` to verify no lingering privileged roles.
- [ ] Retain the completed offboarding ticket as SOC 2 audit evidence for the observation period.
