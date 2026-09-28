# Operator Tools Runbook

> **Scope:** Guidelines for platform operators and superadmins on when and how to use privileged operator tools in Strata.  
> **Standard:** SOC 2 Type II (CC2.3, CC6.3).  
> **Dashboard path:** `/superadmin/operator-tools`, `/superadmin/db-admin`, `/superadmin/emergency`

---

## 1. Principles of Operator Action

1. **Reason Tracking:** Every privileged intervention (impersonation, DB mutation, feature toggle override) requires an explicit reason logged to `auditLogs`.
2. **Time Bounded:** Access tokens and impersonation sessions must have explicit TTLs (default max: 4 hours).
3. **Traceability:** Never perform actions on behalf of customers without a corresponding support ticket or written customer authorization.

---

## 2. Tools Catalog & Authorized Usage

### 2.1 Scheduled Operations Console (`/superadmin/operator-tools`)

- **Purpose:** Monitor cron health, inspect last run status, and pause/resume specific background jobs.
- **When to use:**
  - When an external dependency is degraded (e.g. pause `integration-scheduled-syncs` if an external API is down).
  - During planned maintenance windows.
- **Rule:** Never leave backup or cleanup cron jobs paused longer than 12 hours. Alert the security team if a job fails repeatedly.

### 2.2 Superadmin Access Tokens (`accessTokens.ts`)

- **Purpose:** Issue temporary, time-boxed superadmin accounts for external security auditors, consultants, or temporary engineers.
- **When to use:**
  - External penetration tests, SOC 2 auditor reviews, or specialist incident triage.
- **Rule:** Max duration: 72 hours. Reason must specify the audit engagement or ticket ID. Immediately revoke when the audit session concludes.

### 2.3 User Impersonation (`impersonation.ts`)

- **Purpose:** Session-bounded login as a tenant user to diagnose complex reported bugs.
- **When to use:**
  - Only when reproducible logs cannot resolve a customer-reported issue.
- **Rule:** Mandatory customer consent or ticket reference. All actions while impersonating carry the `impersonatedBy` flag in `auditLogs`.

### 2.4 DB Admin & Data Browser (`dbAdmin.ts`)

- **Purpose:** Low-level inspection and targeted emergency patch of corrupt records.
- **When to use:**
  - Critical data corruption recovery where UI actions are impossible.
- **Rule:** Before/after JSON snapshots are automatically recorded in `adminDbChanges` with one-click rollback available. Never delete tenant data directly outside soft-delete semantics.

### 2.5 Emergency Incidents (`emergency.ts`)

- **Purpose:** Global circuit breakers (e.g. read-only mode, disabling auth provider, global notification banner).
- **When to use:**
  - Active DDoS, severe infrastructure outage, or confirmed credential stuffing attack.
- **Rule:** Post-incident review mandatory within 24 hours per `docs/incident-response.md`.
