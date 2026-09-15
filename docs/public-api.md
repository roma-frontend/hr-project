# Strata Public API v1

Read-only HTTP API for integrations: HRIS sync, payroll export, BI dashboards.

> **Status:** live. Managed from **Settings → API** (org admins and superadmins).
> Metered per organization by the `apiAccess` plan module (`apiCalls` per month).

---

## Base URL

```
<CONVEX_SITE>/api/v1
```

`CONVEX_SITE` is the deployment's **HTTP actions** host — `https://<deployment>.convex.site`,
_not_ the `.convex.cloud` host the app's own client uses. The exact URL is shown and
copyable at Settings → API, so nobody has to derive it by hand.

---

## Authentication

Every request carries a bearer key created at Settings → API:

```bash
curl -H "Authorization: Bearer strata_xxxxxxxxxxxxxxxx" \
  https://<deployment>.convex.site/api/v1/employees
```

The raw key is displayed **once**, at creation. Only its SHA-256 is stored, so a lost key is
revoked and replaced, never recovered.

A key belongs to the **organization**, not to the person who created it — an integration must
not stop working because an employee left.

### Scopes

A key grants only the scopes selected when it was created:

| Scope              | Grants                                  |
| ------------------ | --------------------------------------- |
| `employees:read`   | `GET /employees`, `GET /employees/{id}` |
| `departments:read` | `GET /departments`                      |
| `positions:read`   | `GET /positions`                        |
| `leaves:read`      | `GET /leaves`                           |

`GET /me` needs no scope beyond a valid, enabled key.

A request for a resource the key lacks a scope for returns **403**, and is **not** charged
against the monthly call limit — the scope is resolved from the route before authorization.

---

## Endpoints

### `GET /me`

Confirms the key works and reports the current month's usage.

```json
{
  "organizationId": "jd7…",
  "scopes": ["employees:read", "leaves:read"],
  "usage": { "used": 41, "limit": 100000 }
}
```

### `GET /employees`

| Query param  | Type   | Notes                                 |
| ------------ | ------ | ------------------------------------- |
| `limit`      | number | 1–200, default 50                     |
| `activeOnly` | `true` | Exclude inactive/offboarded employees |

Returns employees of the key's organization. The platform `superadmin` is never included.
National IDs, password hashes, sessions, 2FA secrets, backup codes and face descriptors are
**never** returned — every row is projected through an explicit DTO.

```json
{
  "data": [
    {
      "id": "k57…",
      "email": "aram@example.am",
      "name": "Aram Sargsyan",
      "role": "employee",
      "employeeType": "staff",
      "departmentId": "md3…",
      "department": "Engineering",
      "positionId": "pn2…",
      "position": "Backend Engineer",
      "supervisorId": "k21…",
      "phone": null,
      "location": "Yerevan",
      "avatarUrl": null,
      "isActive": true,
      "isApproved": true,
      "language": "hy",
      "leaveBalances": {
        "paid": 14,
        "sick": 7,
        "family": 3,
        "dayOff": null,
        "maternity": null,
        "study": null
      },
      "createdAt": 1750000000000
    }
  ],
  "count": 1
}
```

### `GET /employees/{id}`

One employee, or **404** when the id does not exist _or_ belongs to another organization.

Cross-tenant reads answer "not found" rather than "forbidden" on purpose: whether an id exists
elsewhere is itself information a key should not be able to harvest.

### `GET /departments`

`limit` (default 50). Returns name (plus localized names), description, manager, active flag.

### `GET /positions`

`limit` (default 50). Returns title (plus localized titles), department, `reportsToPositionId`,
`level`, `rank`, `isDriverPosition`.

Salary bands (`salaryMin` / `salaryMax`) are **deliberately excluded** from v1 — reading the
roster should not imply reading everyone's compensation.

### `GET /leaves`

| Query param | Type                                                        | Notes                    |
| ----------- | ----------------------------------------------------------- | ------------------------ |
| `limit`     | number                                                      | 1–200, default 50        |
| `status`    | `pending` \| `approved` \| `rejected` \| `cancel_requested` |                          |
| `userId`    | string                                                      | Restrict to one employee |

Newest first when unfiltered. Narrower filters use narrower indexes (`by_org_status`,
`by_user_status`).

---

## Rate limiting & quotas

Each call increments the organization's monthly counter for the `apiAccess` module. Limits come
from the plan (`apiCalls`; the default Enterprise limit is 100 000/month).

Every response — success _and_ failure — carries:

```
X-API-Usage: 42
X-API-Limit: 100000
```

so an integration can back off before hitting the wall instead of after.

### Status codes

| Code  | Meaning                                                                       |
| ----- | ----------------------------------------------------------------------------- |
| `200` | OK                                                                            |
| `400` | Malformed argument (e.g. `limit` is not a number, or an id is not a valid id) |
| `401` | Missing or invalid `Authorization` header / unknown key                       |
| `402` | API access is not included in the organization's plan                         |
| `403` | Key disabled, or missing the required scope                                   |
| `404` | Unknown resource or unknown id                                                |
| `429` | Monthly call limit reached                                                    |
| `500` | Unexpected server error                                                       |

Both `401` cases return the same message (`Invalid API key`) so a probe cannot tell a revoked
key from a typo.

---

## CORS

`GET` and `OPTIONS` are allowed from any origin with
`Access-Control-Allow-Headers: Authorization, Content-Type`, so browser-based dashboards can call
the API directly. Note that a key used from a browser is visible to whoever has that browser —
server-side calls are strongly preferred.

---

## Outbound webhooks

Strata → your endpoint deliveries are a **separate** feature with its own signing protocol and
delivery log: see **Settings → Webhooks**. The API above is inbound only.

---

## Roadmap

- Cursor-based pagination (`nextCursor`) instead of `limit` only
- `employees:write` / `leaves:write` scopes
- `GET /attendance` and `GET /payroll` (paid on request, with explicit scopes)
- `updatedAfter` filters for incremental sync
- OpenAPI 3.1 document generated from the Convex validators
