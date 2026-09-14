# SAML 2.0 SSO — Identity Provider Setup Guide

This guide walks an org admin through connecting **Okta** or **Microsoft Entra ID
(Azure AD)** to Strata. Your users then sign in at
`https://<your-strata-domain>/login` with their corporate accounts.

## Terminology

| Term               | Meaning                                        | Value in Strata                                          |
| ------------------ | ---------------------------------------------- | -------------------------------------------------------- |
| SP                 | Service Provider — the app you're logging into | Strata                                                   |
| IdP                | Identity Provider — where accounts live        | Okta / Entra ID / OneLogin / Keycloak                    |
| SP Entity ID       | Unique identifier of the SP                    | `https://<your-domain>/api/sso/metadata`                 |
| ACS URL            | Where the IdP sends signed login responses     | `https://<your-domain>/api/sso/acs/<CONNECTION_ID>`      |
| SP metadata        | XML describing Strata to the IdP               | `https://<your-domain>/api/sso/metadata/<CONNECTION_ID>` |
| NameID / attribute | How the IdP tells us who logged in             | Email (required), display name (optional)                |

`<CONNECTION_ID>` is the 16-character id Strata shows in each connection row
(**Settings → SAML SSO**). Each connection gets its own ACS URL.

## Requirements

- Admin access in Strata (role `admin` or `superadmin`).
- Admin access in your IdP.
- All users who will log in must have a verified email in your corporate domain
  (or set **Auto-create accounts** and keep the domain allowlist tight).
- TLS on both sides (plain http:// is rejected).

---

## 1. Okta (OIDC-free classic SAML app)

### 1.1 Create the SAML app in Okta

1. Okta Admin Console → **Applications → Applications → Create App Integration**.
2. Sign-in method: **SAML 2.0** → Next.
3. **General** tab:
   - App name: `Strata HR`
   - Optional logo.
4. **Configure SAML** tab:
   - **Single sign-on URL** = `https://<your-domain>/api/sso/acs/<CONNECTION_ID>`
     (check _Use this for Recipient URL and Destination URL_).
   - **Audience URI (SP Entity ID)** = `https://<your-domain>/api/sso/metadata`
   - **Name ID format**: `EmailAddress` — Application username: `email`.
   - **Attribute Statements** (optional but recommended):

     | Name          | Format | Value              |
     | ------------- | ------ | ------------------ |
     | `email`       | Basic  | `user.email`       |
     | `displayName` | Basic  | `user.displayName` |

   - Leave group attributes empty.

5. **Feedback** tab: pick _I'm an Okta customer adding an internal app_ → Finish.

### 1.2 Copy IdP values into Strata

1. In the new Okta app → **Sign On** tab → _Metadata details_ → copy:
   - **Issuer** → Strata field **IdP Entity ID**
     (e.g. `http://www.okta.com/exk1234…`)
   - **Sign-on URL** → Strata field **IdP Single Sign-On URL**
     (`https://<your-okta-domain>/app/stratahr/exk1234…/sso/saml`)
2. _X.509 Certificate_ → **View certificate → Download certificate** (it's a
   PEM `.pem`/`.crt` file). Open it in a text editor, copy everything including
   `-----BEGIN CERTIFICATE-----` → Strata field **IdP signing certificate**.

### 1.3 Finish in Strata

1. **Settings → SAML SSO → Add SAML connection**:
   - fill Entity ID / SSO URL / certificate from above,
   - **Allowed email domains**: e.g. `mycompany.com` (mandatory for
     auto-provision safety),
   - **Auto-create accounts**: on if employees may not exist yet in Strata,
   - **Enabled**: on → Save.
2. Click the **copy icon** on the connection row → paste that metadata URL into
   Okta if you prefer metadata-driven setup (_Sign On → Metadata URL_ exchange
   works too: Okta → Application → _SAML Setup Instructions_ accepts it).

### 1.4 Assign people

Okta: **Assignments → Assign to People/Groups** — only assigned users can log in.
Strata: users without an account are auto-provisioned (if enabled) into the
`employee` role with starting leave balances.

---

## 2. Microsoft Entra ID (Azure AD) — Enterprise Application

### 2.1 Create the Enterprise App

1. **Entra admin center → Identity → Applications → Enterprise applications →
   New application → Create your own application.**
   Name: `Strata HR` → _Integrate any other application you don't find in the
   gallery (Non-gallery)_ → Create.
2. Overview → **2. Set up single sign on** → **SAML**.

### 2.2 Basic SAML Configuration

| Field                                      | Value                                               |
| ------------------------------------------ | --------------------------------------------------- |
| Identifier (Entity ID)                     | `https://<your-domain>/api/sso/metadata`            |
| Reply URL (Assertion Consumer Service URL) | `https://<your-domain>/api/sso/acs/<CONNECTION_ID>` |
| Sign on URL                                | `https://<your-domain>/login` (optional)            |
| Relay State                                | leave empty                                         |

> Tip: create the connection in Strata _first_ (step 1.3 below, enabled off)
> so you know the `CONNECTION_ID` while filling Entra.

**Attributes & Claims** (defaults are fine; Entra maps `user.mail` →
`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`, which
Strata reads). Confirm the claim type is **Email address** and the source is
`user.mail`. If your tenant uses `user.userprincipalname` as mail, keep that
but make sure it matches the domain allowlist.

### 2.3 Copy IdP values into Strata

From the Entra **SAML** page, section 3 _SAML Certificates_:

| Entra                                                     | Strata field                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| _App Federation Metadata Url_ (or Entity ID in section 4) | **IdP Entity ID** — e.g. `https://sts.windows.net/<tenant-id>/`                    |
| _Login URL_                                               | **IdP Single Sign-On URL** — `https://login.microsoftonline.com/<tenant-id>/saml2` |
| _Certificate (Base64)_ → download, open in text editor    | **IdP signing certificate**                                                        |

### 2.4 Finish in Strata

Same as Okta §1.3 — Settings → SAML SSO → Add connection, fill the three
fields, set domain allowlist (e.g. `mycompany.com`), enable.

### 2.5 Assign users

Entra: **Enterprise application → Users and groups → Add user/group** — assign
the groups who should have access. Unassigned users are rejected by Entra
before ever reaching Strata.

---

## 3. Testing the flow

1. Open a **private/incognito** window → `https://<your-domain>/login`.
2. In Strata, an SSO button appears for matching domains (email-domain based).
   Alternatively go directly to
   `https://<your-domain>/api/sso/start/<CONNECTION_ID>`.
3. You land on Okta/Entra → authenticate → redirected back → signed into
   Strata with your corporate identity.
4. Admin check: **Settings → SAML SSO → Recent logins** (shared SSO audit log)
   shows `success` / `provisioned` entries with email + timestamp.

Failure states (redirected to `/login?error=…`) — quick triage:

| Error                  | Cause                                 | Fix                                                      |
| ---------------------- | ------------------------------------- | -------------------------------------------------------- |
| `sso_disabled`         | Connection disabled or URL mistyped   | Enable the connection; check CONNECTION_ID               |
| `sso_state_mismatch`   | Stale/back-button replay, cookie lost | Start a fresh login                                      |
| `sso_no_email`         | No email claim in the assertion       | Add `email` attribute (Okta) / verify mail claim (Entra) |
| `sso_domain_denied`    | Email domain not in allowlist         | Add the domain to the connection                         |
| `sso_user_not_found`   | No account and auto-provision off     | Enable auto-provision or pre-create the user             |
| `sso_account_inactive` | User deactivated in Strata            | Reactivate the account                                   |
| `sso_login_rejected`   | Org frozen, user unapproved/suspended | Admin: approve/reactivate; check org status              |

## 4. Security model (for your security team)

- Assertion **signature is verified** against the pinned IdP certificate; the
  certificate is stored write-only (masked in responses).
- **Audience** must match the SP Entity ID, **Recipient** must match the
  connection's ACS URL; freshness window ≈ 90 s enforced.
- Every login attempt is audited (`ssoLoginEvents`), every provisioning writes
  an `auditLogs` row (`sso_user_provisioned`).
- Replay is impossible: login flows are single-use, 10-minute TTL records.
- Sessions are identical to password/Google sessions (7-day JWT cookie +
  server session token) and honor org freeze, suspension and approval checks.
- Optional: also keep OIDC SSO (Settings → Single Sign-On) — both protocols
  can coexist for the same org.

## 5. Troubleshooting checklist

- Clock skew: keep the IdP NTP-synced (assertions expire in minutes).
- Certificate renewed at the IdP → paste the new one in Strata (leave-blank
  keeps the old one, so replace explicitly on rotation).
- Test users: in Okta use _Admin → Applications → Strata → Assign_; in Entra
  the user needs the app assignment **and** a verified `user.mail`.
- `metadata` URL returns XML — if you get 404, your `NEXT_PUBLIC_APP_URL`
  differs from the host you're browsing; the SP Entity ID is derived from it.
