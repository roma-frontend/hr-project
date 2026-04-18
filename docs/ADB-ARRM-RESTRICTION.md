# 🔒 ADB-ARRM Organization Restriction

## Overview

SharePoint and Outlook Calendar integrations are **ONLY** available for the ADB-ARRM organization. This restriction is enforced at multiple levels.

## Implementation

### 1. Constants & Validation Helper

**File:** `src/lib/restricted-org.ts`

```typescript
export const RESTRICTED_ORG_NAME = 'ADB-ARRM';
export const RESTRICTED_ORG_SLUG = 'adb-arrm';
```

**Functions:**

- `isRestrictedOrganization(orgIdentifier)` - checks if org name/slug matches ADB-ARRM
- `validateRestrictedAccess(orgName, orgSlug)` - validates user's org access
- `validateRestrictedOrgFromRequest(request)` - extracts and validates org from JWT token

### 2. API Route Protection

All SharePoint and Outlook Calendar API routes now validate the user's organization:

**Protected Routes:**

- `/api/sharepoint/auth` - SharePoint OAuth initiation
- `/api/sharepoint/callback` - SharePoint OAuth callback
- `/api/sharepoint/sync` - Employee sync from SharePoint
- `/api/sharepoint/status` - SharePoint connection status
- `/api/sharepoint/disconnect` - SharePoint disconnection
- `/api/calendar/outlook/auth` - Outlook Calendar OAuth initiation
- `/api/calendar/outlook/callback` - Outlook Calendar OAuth callback
- `/api/calendar/outlook/sync` - Outlook Calendar event sync

**Validation Flow:**

1. Extract JWT token from `hr-auth-token` cookie
2. Verify JWT and extract `organizationId`
3. Check if `organizationId` matches ADB-ARRM
4. Return 403 Forbidden if not ADB-ARRM

### 3. Backend (Convex) Protection

**File:** `convex/sharepointSync.ts`

All mutations now include org validation:

- `upsertSharePointUser` - validates org before creating/updating users
- `deactivateSharePointUsers` - validates org before deactivating users
- `logSync` - validates org before logging sync operations
- `getLastSync` - validates org before returning sync logs

**Error Message:**

```
"SharePoint integration is restricted to ADB-ARRM organization only"
```

### 4. Frontend UI Protection

**File:** `src/components/settings/IntegrationSettings.tsx`

SharePoint and Outlook Calendar sections are **hidden** for non-ADB-ARRM users:

```typescript
const isRestrictedOrg = user?.organizationId
  ? isRestrictedOrganization(user.organizationId)
  : false;

// SharePoint and Outlook sections only render if isRestrictedOrg === true
{isRestrictedOrg && (
  <Card>
    {/* SharePoint/Outlook UI */}
  </Card>
)}
```

## Security Layers

| Layer              | Protection                 | Bypassable?              |
| ------------------ | -------------------------- | ------------------------ |
| **Frontend UI**    | Hidden UI for non-ADB-ARRM | ❌ No (client-side only) |
| **API Routes**     | JWT validation + org check | ❌ No (server-side)      |
| **Convex Backend** | Org slug validation        | ❌ No (database-level)   |

## Testing

### Test Case 1: ADB-ARRM User

1. Login as user from ADB-ARRM organization
2. Navigate to `/settings` → Integrations tab
3. **Expected:** SharePoint and Outlook Calendar sections are visible
4. **Expected:** SharePoint sync works
5. **Expected:** Outlook Calendar integration works

### Test Case 2: Non-ADB-ARRM User

1. Login as user from any other organization
2. Navigate to `/settings` → Integrations tab
3. **Expected:** SharePoint and Outlook Calendar sections are **NOT visible**
4. **Expected:** Direct API calls return 403 Forbidden
5. **Expected:** Convex mutations throw error

### Test Case 3: API Direct Access (Non-ADB-ARRM)

```bash
# Attempt to access SharePoint sync directly
curl -X POST http://localhost:3000/api/sharepoint/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: hr-auth-token=YOUR_TOKEN" \
  -d '{"adminId":"xxx","organizationId":"yyy"}'

# Expected Response:
{
  "error": "Access restricted to ADB-ARRM organization only"
}
# Status: 403 Forbidden
```

## Error Responses

| Scenario              | Status | Error Message                                                        |
| --------------------- | ------ | -------------------------------------------------------------------- |
| No JWT token          | 401    | "Authentication required"                                            |
| Invalid/expired token | 401    | "Invalid or expired token"                                           |
| Non-ADB-ARRM org      | 403    | "Access restricted to ADB-ARRM organization only"                    |
| Convex mutation       | Error  | "SharePoint integration is restricted to ADB-ARRM organization only" |

## Files Modified

1. `src/lib/restricted-org.ts` - **NEW** - Organization validation helper
2. `src/app/api/sharepoint/auth/route.ts` - Added org validation
3. `src/app/api/sharepoint/callback/route.ts` - Added org validation
4. `src/app/api/sharepoint/sync/route.ts` - Added org validation
5. `src/app/api/sharepoint/status/route.ts` - Added org validation
6. `src/app/api/sharepoint/disconnect/route.ts` - Added org validation
7. `src/app/api/calendar/outlook/auth/route.ts` - Added org validation
8. `src/app/api/calendar/outlook/callback/route.ts` - Added org validation
9. `src/app/api/calendar/outlook/sync/route.ts` - Added org validation
10. `convex/sharepointSync.ts` - Added org validation in all mutations
11. `src/components/settings/IntegrationSettings.tsx` - Hidden UI for non-ADB-ARRM

## Maintenance Notes

- **To change restricted org:** Update `RESTRICTED_ORG_NAME` and `RESTRICTED_ORG_SLUG` in `src/lib/restricted-org.ts` AND `convex/sharepointSync.ts`
- **To add more restricted features:** Use `validateRestrictedOrgFromRequest()` in API routes or `isRestrictedOrganization()` in UI components
- **Organization slug:** Must match the `slug` field in the `organizations` table in Convex
